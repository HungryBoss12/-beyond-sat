import fs from "fs";
import { readDocx } from "../src/lib/import/docx.ts";

const buf = fs.readFileSync("c:/Users/javaz/Downloads/AyuGram Desktop/Nov 2024 Math.docx");
const blocks = await readDocx(new Blob([buf]));

let mod = 1;
let q = 0;
const lines = [];
for (const b of blocks) {
  const t = b.text.trim();
  if (/^Module 2/i.test(t)) {
    mod = 2;
    continue;
  }
  const m = t.match(/^(?:question\s+)?(\d{1,2})\s*(?:[.)]\s*|\s+(?=[A-Za-z"($\\[]))/i);
  if (m && Number(m[1]) <= 22) {
    q = Number(m[1]);
    lines.push(`\n--- M${mod} Q${q} ---`);
    lines.push(t);
    continue;
  }
  if (q && !/^Eng M[12]|^Math M[12]/i.test(t)) lines.push(t);
}

fs.writeFileSync("scripts/nov2024-blocks-dump.txt", lines.join("\n"));
console.log("Wrote nov2024-blocks-dump.txt");
