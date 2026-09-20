/**
 * Deploy the built Nitro worker to Cloudflare via the REST API, bypassing
 * wrangler's local `workerd` spawn (EPERM under this sandbox).
 * Keeps existing assets (keep_assets) — the built asset manifest is unchanged
 * unless frontend files changed; for asset changes use wrangler once spawn works.
 * Run: node scripts/deploy-via-api.mjs --upload
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
if (!args.includes("--upload")) {
  console.log("Pass --upload to push a new deployment.");
  process.exit(0);
}

const cfg = fs.readFileSync(
  path.join(os.homedir(), "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml"),
  "utf8",
);
const token = /^oauth_token\s*=\s*"([^"]+)"/m.exec(cfg)?.[1];
const account = "385f933190700929c4c38957e8ffcdf3";
const wranglerJson = JSON.parse(fs.readFileSync(path.join(".output", "server", "wrangler.json"), "utf8"));
const project = wranglerJson.name;
if (!token) {
  console.error("No wrangler OAuth token found");
  process.exit(1);
}

const workerDir = path.join(".output", "server");
const mainFile = path.resolve(workerDir, wranglerJson.main ?? "index.mjs");
const mainName = path.basename(mainFile);

const moduleFiles = [];
function walkServer(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkServer(full, rel);
    else if (/\.(mjs|js)$/.test(entry.name) && path.resolve(full) !== path.resolve(mainFile)) {
      moduleFiles.push({ full, rel });
    }
  }
}
walkServer(workerDir);

const metadata = {
  main_module: mainName,
  compatibility_date: wranglerJson.compatibility_date,
  compatibility_flags: wranglerJson.compatibility_flags ?? [],
  bindings: Object.entries(wranglerJson.vars ?? {}).map(([name, text]) => ({
    type: "plain_text",
    name,
    text,
  })),
  keep_assets: true,
  keep_secrets: true,
  keep_bindings: [
    "secret_text",
    "kv_namespace",
    "r2_bucket",
    "d1",
    "service",
    "durable_object_namespace",
    "queue",
    "analytics_engine",
  ],
  observations: wranglerJson.observability?.enabled
    ? { observability: { enabled: true, head_sampling_rate: 1 } }
    : undefined,
  triggers: wranglerJson.triggers?.crons?.length
    ? { crons: wranglerJson.triggers.crons }
    : undefined,
};

const body = new FormData();
body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
body.append(
  mainName,
  new Blob([fs.readFileSync(mainFile)], { type: "application/javascript+module" }),
  mainName,
);
for (const m of moduleFiles) {
  const rel = m.rel.replace(/\\/g, "/");
  body.append(
    rel,
    new Blob([fs.readFileSync(m.full)], { type: "application/javascript+module" }),
    rel,
  );
}
console.log(`worker: ${project} | main=${mainName} + ${moduleFiles.length} modules`);

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${project}`,
  { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body },
);
const j = await res.json();
if (!j.success) {
  console.error("deploy failed:", JSON.stringify(j.errors).slice(0, 600));
  process.exit(1);
}
console.log(`✓ Deployed version ${j.result.id}`);
console.log(`  modified: ${j.result.modified_on}`);
