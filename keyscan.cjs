// Temporary diagnostic: find which file on disk contains the exact placeholder
// value currently in OPENROUTER_API_KEY. Prints file paths only, never values.
const fs = require("fs");
const path = require("path");

const needle = process.env.OPENROUTER_API_KEY;
if (!needle) {
  console.log("OPENROUTER_API_KEY not set in this process; nothing to trace.");
  process.exit(0);
}

const roots = [
  "c:/Users/javaz/Downloads/beyond-sat",
  "c:/Users/javaz/.claude",
  "c:/Users/javaz/AppData/Roaming/Code/User",
  "c:/Users/javaz/AppData/Roaming/npm",
];
const SKIP = new Set(["node_modules", ".git", "dist", ".output", ".nitro", ".vinxi", "logs"]);
const MAX_BYTES = 2_000_000;
const hits = [];
let scanned = 0;

function walk(dir, depth) {
  if (depth > 6) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      walk(full, depth + 1);
    } else if (e.isFile()) {
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.size > MAX_BYTES) continue;
      let raw;
      try {
        raw = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      scanned++;
      if (raw.includes(needle)) hits.push(full);
    }
  }
}

for (const r of roots) walk(r, 0);
console.log("files scanned: " + scanned);
console.log("files containing that exact value:");
console.log(hits.length ? hits.map((h) => "  " + h).join("\n") : "  (none)");
