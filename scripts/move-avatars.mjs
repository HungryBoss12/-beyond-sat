/**
 * Move old chat photos into the avatars bucket.
 * Photos set up in the class chat live in chat-uploads as <uid>/avatar-<digits>.<ext>.
 * This copies each one to avatars with the same path. The profile keeps pointing at the
 * same path, and the app looks in avatars first. Dry run unless --execute is passed.
 * The old files are kept; delete them later once the move looks right.
 *
 *   node scripts/move-avatars.mjs
 *   node scripts/move-avatars.mjs --execute
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execute = process.argv.includes("--execute");

function loadDevVars() {
  const path = resolve(root, ".dev.vars");
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = val;
  }
  return env;
}

const vars = { ...loadDevVars(), ...process.env };
const url = vars.SUPABASE_URL || vars.VITE_SUPABASE_URL;
const key = vars.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .dev.vars or the environment.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const PATH_RE = /^[0-9a-f-]{36}\/avatar-[A-Za-z0-9_-]{6,64}\.(webp|jpg|jpeg|png)$/i;

const { data: rows, error } = await supabase
  .from("profiles")
  .select("id, avatar_url")
  .not("avatar_url", "is", null);
if (error) throw error;

let moved = 0;
let skipped = 0;
let missing = 0;
for (const row of rows ?? []) {
  const path = (row.avatar_url ?? "").trim();
  if (!PATH_RE.test(path)) {
    skipped += 1;
    continue;
  }
  const inNew = await supabase.storage.from("avatars").download(path);
  if (!inNew.error) {
    skipped += 1;
    continue;
  }
  const old = await supabase.storage.from("chat-uploads").download(path);
  if (old.error || !old.data) {
    missing += 1;
    console.log(`missing  ${path}`);
    continue;
  }
  if (old.data.size > 2 * 1024 * 1024) {
    skipped += 1;
    console.log(`too big  ${path} (${old.data.size} bytes)`);
    continue;
  }
  if (!execute) {
    console.log(`would move ${path}`);
    moved += 1;
    continue;
  }
  const up = await supabase.storage
    .from("avatars")
    .upload(path, old.data, { contentType: old.data.type || undefined, upsert: true });
  if (up.error) {
    console.log(`failed   ${path}: ${up.error.message}`);
    continue;
  }
  console.log(`moved    ${path}`);
  moved += 1;
}
console.log(
  `${execute ? "Moved" : "Would move"} ${moved}, skipped ${skipped}, missing ${missing}.` +
    (execute ? "" : " Pass --execute to copy."),
);
