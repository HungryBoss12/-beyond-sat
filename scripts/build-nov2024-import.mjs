/**
 * Build Nov 2024 question JSON from readDocx blocks + embedded answer key.
 */
import fs from "fs";
import { readDocx, FIGURE_MARKER } from "../src/lib/import/docx.ts";

const ANSWERS = {
  1: ["C","A","A","B","A","C","D","35","A","A","B","C","22","C","D","D","D","7.5","B","363","15100","-196"],
  2: ["B","C","A","A","C","D","B","B","B","D","A","C","4","D","A","D","29","C","A","12.8","32/21","-37"],
};

const buf = fs.readFileSync("c:/Users/javaz/Downloads/AyuGram Desktop/Nov 2024 Math.docx");
const blocks = await readDocx(new Blob([buf]));

let mod = 1;
let cur = null;
const questions = [];

function flush() {
  if (!cur) return;
  const ans = ANSWERS[cur.module][cur.position - 1];
  const isGrid = !/^[A-D]$/i.test(ans);
  const choiceLine = cur.lines.find((l) => /^A\)/.test(l.trim()));
  let choices = [];
  if (choiceLine) {
    const parts = choiceLine.split(/\t+/).filter(Boolean);
    if (parts.length >= 4) {
      choices = parts.slice(0, 4).map((p, i) => ({
        id: String.fromCharCode(65 + i),
        text: p.replace(/^[A-D]\)\s*/, "").trim(),
      }));
    } else {
      const re = /([A-D])\)\s*([^A-D]*)/g;
      let m;
      while ((m = re.exec(choiceLine))) {
        choices.push({ id: m[1], text: m[2].trim() });
      }
    }
  }
  const body = cur.lines.filter((l) => !/^A\)/.test(l.trim()) && !/^\d+\./.test(l.trim()));
  const figureIdx = body.findIndex((l) => l.includes("FIGURE NEEDED"));
  let prompt = null;
  let rest = body;
  if (figureIdx >= 0) {
    prompt = FIGURE_MARKER;
    rest = body.filter((l, i) => i !== figureIdx);
  } else if (body.length > 1) {
    const last = body[body.length - 1];
    if (last.length > 20 && body.length >= 2) {
      prompt = body.slice(0, -1).join("\n").trim() || null;
      rest = [last];
    }
  }
  const question_text = rest.join("\n").trim() || `Question ${cur.position}`;
  questions.push({
    module: cur.module,
    position: cur.position,
    kind: isGrid ? "grid_in" : "multiple_choice",
    prompt,
    question_text,
    choices: isGrid ? [] : choices,
    correct_choice_id: isGrid ? null : ans.toUpperCase(),
    correct_grid_answers: isGrid ? [ans] : null,
  });
}

for (const b of blocks) {
  const t = b.text.trim();
  if (!t || t.startsWith("|") || /^Eng M/i.test(t) || /^Math M/i.test(t)) continue;
  if (/^Module 2/i.test(t)) {
    flush();
    mod = 2;
    cur = null;
    continue;
  }
  const qm = t.match(/^(?:question\s+)?(\d{1,2})\.\s*(.*)$/i);
  if (qm && Number(qm[1]) <= 22) {
    flush();
    cur = { module: mod, position: Number(qm[1]), lines: qm[2] ? [qm[2]] : [] };
    continue;
  }
  if (cur) cur.lines.push(t);
}
flush();

fs.writeFileSync("scripts/nov2024-built.json", JSON.stringify(questions, null, 2));
console.log(`Built ${questions.length} questions`);
