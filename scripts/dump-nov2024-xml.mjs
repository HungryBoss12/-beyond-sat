/**
 * Plain-text dump of Nov 2024 Math.docx questions from document.xml.
 */
import fs from "fs";

const xml = fs.readFileSync("tmp-nov2024-math/word/document.xml", "utf8");
let mod = 1;
let q = 0;
let cur = null;
const questions = [];

function flush() {
  if (cur) questions.push({ ...cur });
}

const paras = xml.split(/<w:p[ >]/).slice(1);
for (const p of paras) {
  const text = [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((x) => x[1])
    .join("")
    .trim();
  if (!text) continue;
  if (/^Module 2/i.test(text)) {
    mod = 2;
    continue;
  }
  const qm = text.match(/^(?:question\s+)?(\d{1,2})\s*(?:[.)]\s*|\s+(?=[A-Za-z"(]))/i);
  if (qm && Number(qm[1]) <= 22) {
    flush();
    q = Number(qm[1]);
    cur = { module: mod, position: q, lines: [text.replace(/^\d+\.?\s*/, "")].filter(Boolean) };
    continue;
  }
  if (cur) cur.lines.push(text);
}

flush();
fs.writeFileSync("scripts/nov2024-dump.txt", questions.map((q) => 
  `\n=== M${q.module} Q${q.position} ===\n${q.lines.join("\n")}`
).join("\n"));
console.log(`Dumped ${questions.length} questions`);
