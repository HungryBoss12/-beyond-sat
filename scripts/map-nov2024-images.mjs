import fs from "fs";

const xml = fs.readFileSync("tmp-nov2024-math/word/document.xml", "utf8");
const rels = fs.readFileSync("tmp-nov2024-math/word/_rels/document.xml.rels", "utf8");
const rmap = {};
for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="media\/([^"]+)"/g)) {
  rmap[m[1]] = m[2];
}

let mod = 1;
let q = 0;
const paras = xml.split(/<w:p[ >]/).slice(1);
const hits = [];

for (const p of paras) {
  const text = [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((x) => x[1])
    .join("")
    .trim();
  if (/^Module 2/i.test(text)) {
    mod = 2;
    continue;
  }
  const qm = text.match(/^(?:question\s+)?(\d{1,2})\s*(?:[.)]\s*|\s+(?=[A-Za-z"(]))/i);
  if (qm && Number(qm[1]) <= 22) q = Number(qm[1]);

  const imgs = [];
  for (const m of p.matchAll(/r:embed="([^"]+)"/g)) {
    const f = rmap[m[1]];
    if (f) imgs.push(f);
  }
  if (imgs.length) hits.push({ mod, q, text: text.slice(0, 80), imgs });
}

console.log(JSON.stringify(hits, null, 2));
