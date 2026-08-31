import fs from "fs";
import { readDocx } from "../src/lib/import/docx.ts";

const buf = fs.readFileSync(
  "c:/Users/javaz/Downloads/AyuGram Desktop/May 2024 Math Version C (2).docx",
);
const blocks = await readDocx(new Blob([buf]));
let mod = 1;
let q = 0;
for (const b of blocks) {
  const t = b.text.trim();
  if (/^Module 2/i.test(t)) {
    mod = 2;
    continue;
  }
  const m = t.match(/^(?:question\s+)?(\d{1,3})\s*(?:[.)]\s*|\s+(?=[A-Za-z"(]))/i);
  if (m && Number(m[1]) <= 22) {
    q = Number(m[1]);
    console.log(`\n--- M${mod} Q${q} ---`);
    console.log(t);
    continue;
  }
  if (q) console.log(t);
}
