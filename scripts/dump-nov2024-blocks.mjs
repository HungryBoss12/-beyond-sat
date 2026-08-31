import fs from "fs";
import { readDocx } from "../src/lib/import/docx.ts";
import { blocksToDrafts, stampDraftModules } from "../src/lib/import/parse.ts";

const buf = fs.readFileSync("c:/Users/javaz/Downloads/AyuGram Desktop/Nov 2024 Math.docx");
const blocks = await readDocx(new Blob([buf]));
const parsed = blocksToDrafts(blocks, {
  section: "math",
  skill: "Algebra",
  difficulty: "C",
  source_month: "11",
  source_year: "2024",
});
const drafts = stampDraftModules(parsed.drafts, "math");

const out = drafts.map((d) => ({
  module: d.rec.module === "2" ? 2 : 1,
  position: d.number,
  kind: d.rec.kind || "multiple_choice",
  prompt: d.rec.prompt || null,
  question_text: d.rec.question_text,
  choice_A: d.rec.choice_A || "",
  choice_B: d.rec.choice_B || "",
  choice_C: d.rec.choice_C || "",
  choice_D: d.rec.choice_D || "",
  warnings: d.warnings,
}));

fs.writeFileSync("scripts/nov2024-drafts.json", JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} drafts`);
