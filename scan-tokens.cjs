// Temp audit v2: only real shadcn semantic tokens, and only in files that are
// actually reachable from the app (imported somewhere). Run: node scan-tokens.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "src");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

const declared = new Set();
for (const m of css.matchAll(/--(?:color-)?([a-z0-9-]+)\s*:/g)) declared.add(m[1]);

// The shadcn token vocabulary. Anything else after bg-/text-/etc is a Tailwind
// built-in scale or our brand ramp, and is not token-driven.
const TOKENS = [
  "background", "foreground",
  "card", "card-foreground",
  "popover", "popover-foreground",
  "primary", "primary-foreground",
  "secondary", "secondary-foreground",
  "muted", "muted-foreground",
  "accent", "accent-foreground",
  "destructive", "destructive-foreground",
  "border", "input", "ring", "ring-offset-background",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
];
// longest first so "card-foreground" wins over "card"
TOKENS.sort((a, b) => b.length - a.length);
const USE = new RegExp(
  "\\b(?:bg|text|border|ring|fill|stroke|divide|placeholder|from|to|via|outline|caret|decoration|shadow)-(" +
    TOKENS.join("|") +
    ")\\b",
  "g"
);

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes("routeTree.gen")) files.push(p);
  }
})(ROOT);

const src = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));

// A ui/* primitive counts as reachable if any file OUTSIDE components/ui imports
// it, or if a reachable ui file imports it (one hop is enough here).
const uiFiles = files.filter((f) => f.includes(path.join("components", "ui")));
const outside = files.filter((f) => !f.includes(path.join("components", "ui")));
function importedBy(file, pool) {
  const stem = path.basename(file).replace(/\.tsx?$/, "");
  const re = new RegExp(`from\\s+["']@/components/ui/${stem}["']`);
  return pool.some((p) => p !== file && re.test(src.get(p)));
}
const reachable = new Set(outside);
for (const f of uiFiles) if (importedBy(f, outside)) reachable.add(f);
for (const f of uiFiles) if (!reachable.has(f) && importedBy(f, [...reachable])) reachable.add(f);

const hits = new Map();
const dead = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const live = reachable.has(f);
  src.get(f).split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(USE)) {
      const name = m[1];
      if (declared.has(name)) continue;
      const at = `${rel}:${i + 1}`;
      if (!live) { dead.push(`${name} @ ${at}`); continue; }
      if (!hits.has(name)) hits.set(name, []);
      if (hits.get(name).length < 6) hits.get(name).push(at);
    }
  });
}

console.log("=== UNDEFINED TOKENS IN REACHABLE FILES ===");
if (!hits.size) console.log("(none)");
for (const [name, at] of [...hits].sort()) console.log(`--${name}  ${at.join("  ")}`);

console.log("\n=== same, but in UNREACHABLE ui primitives (dead code) ===");
console.log(dead.length ? `${dead.length} hits, e.g. ${dead.slice(0, 5).join(" | ")}` : "(none)");

console.log("\n=== ui/* primitives never imported anywhere ===");
const unused = uiFiles.filter((f) => !reachable.has(f)).map((f) => path.basename(f));
console.log(unused.length ? unused.join(", ") : "(none)");
