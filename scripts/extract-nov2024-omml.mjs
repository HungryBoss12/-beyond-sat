import fs from "fs";
import { ommlBlockToLatex } from "../src/lib/import/docx.ts";

const xml = fs.readFileSync("tmp-nov2024-math/word/document.xml", "utf8");
const chunks = xml.split(/<w:p(?=[\s/>])/);
let mod = 1;
let q = 0;

function plain(chunk) {
  return chunk
    .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const out = [];
for (const chunk of chunks) {
  const t = plain(chunk);
  if (/^Module 2$/i.test(t)) mod = 2;
  const qm = t.match(/^(\d{1,2})\.\s/);
  if (qm && Number(qm[1]) <= 22) q = Number(qm[1]);
  if (!q) continue;
  const latex = ommlBlockToLatex(chunk);
  if (latex && latex.length > 2 && !latex.includes("w14:paraId")) {
    out.push({ mod, q, text: t.slice(0, 120), latex: latex.slice(0, 500) });
  }
}

fs.writeFileSync("scripts/nov2024-omml.json", JSON.stringify(out, null, 2));
console.log(`OMML blocks: ${out.length}`);
