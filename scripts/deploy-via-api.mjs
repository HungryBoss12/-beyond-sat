/**
 * Full deploy: upload Workers Static Assets + script modules via Cloudflare API.
 * Fixes keep_assets-only deploys that left hashed CSS/JS 404.
 *
 * Run: node scripts/deploy-via-api.mjs --upload
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

if (!process.argv.includes("--upload")) {
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
const assetsDir = path.resolve(workerDir, wranglerJson.assets?.directory ?? "../public");
const mainFile = path.resolve(workerDir, wranglerJson.main ?? "index.mjs");
const mainName = path.basename(mainFile);
const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;
const auth = { Authorization: `Bearer ${token}` };

function guessType(name) {
  const ext = path.extname(name).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".mjs": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".txt": "text/plain; charset=utf-8",
      ".webmanifest": "application/manifest+json",
      ".map": "application/json",
    }[ext] ?? "application/octet-stream"
  );
}

const assets = [];
function walkAssets(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkAssets(full, rel);
    else {
      const buf = fs.readFileSync(full);
      // Workers Assets hash = first 32 hex chars of sha256
      const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
      assets.push({ path: rel.replace(/\\/g, "/"), buf, hash, type: guessType(entry.name) });
    }
  }
}
walkAssets(assetsDir);
console.log(`worker: ${project}`);
console.log(`assets: ${assets.length} files, ${(assets.reduce((a, f) => a + f.buf.length, 0) / 1e6).toFixed(1)} MB`);

// ---- 1. Create upload session ----
const manifest = {};
for (const f of assets) {
  manifest[`/${f.path}`] = { hash: f.hash, size: f.buf.length };
}
const sessionRes = await fetch(`${api}/workers/scripts/${project}/assets-upload-session`, {
  method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ manifest }),
});
const session = await sessionRes.json();
if (!session.success) {
  console.error("asset session failed:", JSON.stringify(session.errors));
  process.exit(1);
}

let completionJwt = session.result.jwt;
const buckets = session.result.buckets ?? [];
const byHash = new Map(assets.map((f) => [f.hash, f]));
const toUpload = buckets.flat().filter((h) => byHash.has(h));
console.log(`session ok; ${toUpload.length} hashes across ${buckets.length} bucket(s) need upload`);

// ---- 2. Upload missing assets (one FormData per bucket; CF returns a new jwt) ----
for (let bi = 0; bi < buckets.length; bi++) {
  const hashes = buckets[bi];
  if (!hashes?.length) continue;
  const form = new FormData();
  for (const hash of hashes) {
    const f = byHash.get(hash);
    if (!f) continue;
    // CF Workers Assets upload expects base64-encoded file bodies when ?base64=true
    form.append(hash, new Blob([f.buf.toString("base64")], { type: f.type }), hash);
  }
  const upRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/assets/upload?base64=true`,
    { method: "POST", headers: { Authorization: `Bearer ${completionJwt}` }, body: form },
  );
  const up = await upRes.json().catch(() => ({ success: false, errors: [{ message: String(upRes.status) }] }));
  if (!up.success) {
    console.error(`bucket ${bi} upload failed:`, JSON.stringify(up.errors).slice(0, 400));
    process.exit(1);
  }
  if (up.result?.jwt) completionJwt = up.result.jwt;
  console.log(`  uploaded bucket ${bi + 1}/${buckets.length} (${hashes.length} files)`);
}

// ---- 3. Collect modules ----
const moduleFiles = [];
function walkServer(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkServer(full, rel);
    else if (/\.(mjs|js)$/.test(entry.name) && path.resolve(full) !== path.resolve(mainFile)) {
      moduleFiles.push({ full, rel: rel.replace(/\\/g, "/") });
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
  assets: {
    jwt: completionJwt,
    config: {
      html_handling: wranglerJson.assets?.html_handling ?? "auto-trailing-slash",
      not_found_handling: wranglerJson.assets?.not_found_handling ?? "404-page",
      run_worker_first: wranglerJson.assets?.run_worker_first ?? false,
    },
  },
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
  body.append(
    m.rel,
    new Blob([fs.readFileSync(m.full)], { type: "application/javascript+module" }),
    m.rel,
  );
}
console.log(`deploying script: main=${mainName} + ${moduleFiles.length} modules`);

const res = await fetch(`${api}/workers/scripts/${project}`, {
  method: "PUT",
  headers: auth,
  body,
});
const j = await res.json();
if (!j.success) {
  console.error("deploy failed:", JSON.stringify(j.errors).slice(0, 800));
  process.exit(1);
}
console.log(`✓ Deployed version ${j.result.id}`);
console.log(`  modified: ${j.result.modified_on}`);
console.log(`  assets: ${assets.length} files bound`);
