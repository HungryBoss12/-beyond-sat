/**
 * E2E: create a disposable user (service role), sign in, hit youtube-recs with
 * section=math and section=rw, print titles. Verifies section scoping live.
 * Run: node scripts/check-recs-sections.mjs
 */
import fs from "node:fs";

function loadDevVars() {
  return Object.fromEntries(
    fs.readFileSync(".dev.vars", "utf8").split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}
const env = loadDevVars();
const url = "https://qlzvngegsemrzmyxwykl.supabase.co";
const anon = env.SUPABASE_ANON_KEY ?? env.SUPABASE_PUBLISHABLE_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

const email = `pentest-recs-${Date.now()}@disposable.invalid`;
const password = "Recs!" + Math.random().toString(36).slice(2, 12);
const create = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true }),
});
if (!create.ok) {
  console.error("create user failed:", create.status);
  process.exit(1);
}
const created = await create.json();
console.log("disposable user:", created.id);

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const lj = await login.json();
if (!lj.access_token) {
  console.error("login failed:", lj.error_description ?? login.status);
  process.exit(1);
}
console.log("signed in");

const origin = "https://beyond-sat-v0.javazbek80.workers.dev";
let ok = true;
const seen = { math: [], rw: [] };
for (const section of ["math", "rw", "math"]) {
  const res = await fetch(`${origin}/api/ai/youtube-recs?section=${section}`, {
    headers: { authorization: `Bearer ${lj.access_token}`, apikey: anon },
  });
  const j = await res.json().catch(() => ({ videos: [] }));
  const titles = (j.videos ?? []).map((v) => v.title ?? "");
  seen[section].push(...titles);
  console.log(`\nsection=${section} → HTTP ${res.status}`);
  for (const t of titles) console.log(`  - ${t}`);
}

// Cleanup disposable user.
await fetch(`${url}/auth/v1/admin/users/${created.id}`, {
  method: "DELETE",
  headers: { apikey: service, authorization: `Bearer ${service}` },
});
console.log("\ndisposable user deleted");
process.exit(ok ? 0 : 1);
