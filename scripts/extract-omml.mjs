import fs from "fs";
import { readDocx, ommlBlockToLatex } from "../src/lib/import/docx.ts";

const xml = fs.readFileSync(
  "C:/Users/javaz/AppData/Local/Temp/math-docx-v2/word/document.xml",
  "utf8",
);
const chunks = xml.split(/<w:p(?=[\s/>])/);
for (const chunk of chunks) {
  if (
    !chunk.includes("positive numbers") &&
    !chunk.includes("slope of") &&
    !chunk.includes("f(x) =") &&
    !chunk.includes("edge of the pyramid") &&
    !chunk.includes("Which statement is the best interpretation of")
  )
    continue;
  const latex = ommlBlockToLatex(chunk);
  const plain = chunk
    .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, "$1")
    .replace(/<m:t[^>]*>([\s\S]*?)<\/m:t>/g, "[$1]")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  console.log("---");
  console.log(plain);
  if (latex) console.log("LATEX:", latex.slice(0, 300));
}
