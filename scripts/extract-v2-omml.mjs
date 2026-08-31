import fs from "fs";
import { readDocx, ommlBlockToLatex } from "../src/lib/import/docx.ts";

const DOCX =
  "c:/Users/javaz/Downloads/AyuGram Desktop/May 2024 Math Version C (2).docx";

const buf = fs.readFileSync(DOCX);
const blocks = await readDocx(new Blob([buf]));

// Re-read raw XML paragraphs for OMML not captured in blocks
const zip = await import("node:buffer").then(() => null);
// manual unzip via readDocx internals - dump blocks with index
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  const hasFigure = b.text.includes("[FIGURE NEEDED");
  const hasEmptyMath = /,\s+and\s+\.|sin y|slope of\s+and|f\(x\)\s*=|p\(x\)|\+ 9$|written as ,/.test(b.text);
  if (hasFigure || hasEmptyMath || b.images?.length) {
    console.log(`\n=== block ${i} ===`);
    console.log(b.text.slice(0, 400));
    if (b.images?.length) console.log(`(${b.images.length} embedded image(s))`);
  }
}
