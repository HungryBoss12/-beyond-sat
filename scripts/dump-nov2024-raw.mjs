import fs from "fs";
import { readDocx } from "../src/lib/import/docx.ts";

const buf = fs.readFileSync("c:/Users/javaz/Downloads/AyuGram Desktop/Nov 2024 Math.docx");
const blocks = await readDocx(new Blob([buf]));
for (let i = 0; i < blocks.length; i++) {
  const t = blocks[i].text;
  if (t.includes("$") || t.includes("FIGURE") || /^\d+\./.test(t.trim())) {
    console.log(`\n[${i}] ${t.slice(0, 300).replace(/\n/g, " ")}`);
  }
}
