import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode, command }) => {
  const envDefine: Record<string, string> = {};
  const clientEnv: Record<string, string> = {};

  /* `.env` is no longer committed, so a fresh checkout (e.g. a Cloudflare git
     build) gets the public client values from, in order: build-time VITE_*
     variables, a local `.env`, then the public `vars` in wrangler.jsonc. */
  try {
    const raw = readFileSync(`${process.cwd()}/wrangler.jsonc`, "utf8")
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n")
      .replace(/,(\s*[}\]])/g, "$1");
    const vars = (JSON.parse(raw) as { vars?: Record<string, string> }).vars ?? {};
    const map: Record<string, string> = {
      SUPABASE_URL: "VITE_SUPABASE_URL",
      SUPABASE_PUBLISHABLE_KEY: "VITE_SUPABASE_PUBLISHABLE_KEY",
      SUPABASE_PROJECT_ID: "VITE_SUPABASE_PROJECT_ID",
    };
    if (typeof vars.WORKER_PUBLIC_URL === "string" && vars.WORKER_PUBLIC_URL) {
      clientEnv.VITE_APP_URL = vars.WORKER_PUBLIC_URL;
    }
    for (const [from, to] of Object.entries(map)) {
      if (typeof vars[from] === "string" && vars[from]) clientEnv[to] = vars[from];
    }
  } catch {
    /* wrangler.jsonc is optional here */
  }
  Object.assign(clientEnv, loadEnv(mode, process.cwd(), "VITE_"));
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("VITE_") && value) clientEnv[key] = value;
  }
  for (const [key, value] of Object.entries(clientEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
        exceljs: `${process.cwd()}/node_modules/exceljs/dist/exceljs.min.js`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      // Windows throws EBUSY if a watched file is locked. Agent skill files
      // are not app source, and a lock there was killing `npm run dev`.
      watch: {
        ignored: ["**/.agents/**", "**/.cursor/**", "**/.output/**"],
      },
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      ...(command === "build"
        ? [
            nitro({
              defaultPreset: "cloudflare-module",
              plugins: ["./src/nitro/scheduled.ts"],
            }),
          ]
        : []),
      viteReact(),
    ],
  };
});
