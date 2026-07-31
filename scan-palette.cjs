// Temp audit: flags off-palette colour classes left in src.
// Run: node scan-palette.cjs   (delete afterwards)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "src");
const BAD = [
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|accent|decoration|outline|shadow|divide|placeholder|caret)-(?:red|rose|pink|fuchsia|purple|violet|indigo|green|emerald|teal|cyan|sky|lime|yellow|amber|orange|stone|neutral|zinc|gray)-\d{2,3}\b/g,
  /\bbg-slate-\d{2,3}\b/g,
  /\btext-slate-(?:400|500|600|700|800|900)\b/g,
  /\bborder-slate-\d{2,3}\b/g,
  /\bbg-black\b/g,
  /\bbg-black\/\d+\b/g,
  /\bsoft-shadow\b/g,
  /\btext-primary\b/g,
  /\bLoader2\b/g,
];

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts|css)$/.test(e.name) && !e.name.includes("routeTree.gen")) files.push(p);
  }
})(ROOT);

let total = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (rel.startsWith("components" + path.sep + "ui" + path.sep)) continue; // shadcn primitives are token-driven
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    for (const re of BAD) {
      const m = line.match(re);
      if (m) hits.push(`  ${i + 1}: ${m.join(", ")}  |  ${line.trim().slice(0, 110)}`);
    }
  });
  if (hits.length) {
    total += hits.length;
    console.log(rel);
    console.log(hits.join("\n"));
  }
}
console.log(`\n--- ${total} hits across ${files.length} files ---`);
