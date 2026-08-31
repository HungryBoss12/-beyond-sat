import fs from "fs";
import { ommlBlockToLatex } from "../src/lib/import/docx.ts";

const xml = fs.readFileSync("tmp-math-v2/word/document.xml", "utf8");
const chunks = xml.split(/<w:p(?=[\s/>])/);
let mod = 1;

function plain(chunk) {
  return chunk
    .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, "$1")
    .replace(/<m:t[^>]*>([\s\S]*?)<\/m:t>/g, "[$1]")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

for (const chunk of chunks) {
  const t = plain(chunk);
  if (/^Module 2$/i.test(t)) mod = 2;
  const interesting =
    t.includes("given equation relates") ||
    t.includes("One solution to the given equation") ||
    (t.startsWith("10.") && mod === 2) ||
    (t.includes("f(x) =") && mod === 1 && t.includes("7,000")) ||
    (t.includes("loan") && t.includes("$298")) ||
    t.includes("sin y") ||
    (t.startsWith("18.") && t.includes("slope"));
  if (!interesting) continue;
  const latex = ommlBlockToLatex(chunk);
  console.log(`\n=== M${mod} ===`);
  console.log(t.slice(0, 500));
  if (latex && !latex.includes("w14:paraId")) console.log("LATEX:", latex.slice(0, 400));
}
