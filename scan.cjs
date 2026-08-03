const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "src");
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e.name)) files.push(p);
  }
})(SRC);
const rel = (p) => path.relative(__dirname, p).replace(/\\/g, "/");

const pats = {
  "fixed inset-0 (hand-rolled overlays)": /fixed inset-0/,
  "route-enter (transform wrapper)": /route-enter/,
  "createPortal (already portalled)": /createPortal/,
  "radix Dialog/Sheet (portals itself)": /@radix-ui\/react-(dialog|alert-dialog)/,
};
for (const [name, re] of Object.entries(pats)) {
  console.log("=== " + name + " ===");
  let n = 0;
  for (const f of files) {
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((l, i) => {
      if (re.test(l)) {
        console.log("  " + rel(f) + ":" + (i + 1) + "  " + l.trim().slice(0, 110));
        n++;
      }
    });
  }
  if (n === 0) console.log("  (none)");
  console.log("");
}
