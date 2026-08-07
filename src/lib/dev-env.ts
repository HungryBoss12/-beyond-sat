/**
 * Dev-only bridge from dotenv files to `process.env`.
 *
 * On the edge, secrets arrive as the `env` argument to `fetch`. Under `vite dev`
 * there is no such argument, and — unlike the production build — nothing puts
 * dotenv values onto `process.env` either: the Lovable config only runs
 * `loadEnv(mode, cwd, "VITE_")` to `define` the `import.meta.env.VITE_*`
 * literals, and the Nitro plugin that reads `.env`/`.env.local` is registered
 * only when `command === "build"`. So a non-prefixed secret such as
 * `OPENROUTER_API_KEY` is invisible in dev no matter which file it sits in, and
 * `wrangler secret put` sets it on the *deployed* Worker, which `vite dev`
 * never talks to.
 *
 * This closes that gap for local development only. The whole thing is wrapped in
 * `if (import.meta.env.DEV)` at the call site, which the production build
 * substitutes with `false` so Rollup drops the branch — including the
 * `import("node:fs")` below, which would otherwise pull a Node builtin into the
 * Worker bundle.
 */

/** Priority order: first file to define a key wins. */
const FILES = [".dev.vars", ".env.local", ".env"];

/**
 * Minimal `KEY=VALUE` parser.
 *
 * Deliberately not `node:util.parseEnv` (added in Node 20.12) or the `dotenv`
 * package (not a dependency) — this needs to work on whatever Node the user has
 * without adding a dep for a dev-only path.
 */
function parseEnvFile(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq < 1) continue;

    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
      /* Only double quotes carry escapes, matching dotenv. */
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    } else {
      /* Unquoted values end at an inline comment. A quoted value may legitimately
         contain a "#", which is why this only applies here. */
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    out[key] = value;
  }
  return out;
}

let loaded: Promise<void> | undefined;

/**
 * Merges dotenv files into `process.env`, once per process.
 *
 * Existing values are never overwritten, so a variable exported in the shell
 * still beats a file — the usual precedence, and it keeps a stale `.env` from
 * shadowing a deliberate one-off override.
 */
export function loadDevEnv(): Promise<void> {
  loaded ??= (async () => {
    try {
      const { readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");

      for (const file of FILES) {
        let source: string;
        try {
          source = readFileSync(resolve(process.cwd(), file), "utf-8");
        } catch {
          continue; // Absent file is the normal case, not an error.
        }
        for (const [key, value] of Object.entries(parseEnvFile(source))) {
          if (!process.env[key]?.trim()) process.env[key] = value;
        }
      }
    } catch (error) {
      console.error("[dev-env] could not read dotenv files", error);
    }
  })();
  return loaded;
}
