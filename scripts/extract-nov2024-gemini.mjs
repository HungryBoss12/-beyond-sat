import fs from "fs";
import { GoogleGenAI } from "@google/genai";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim().replace(/\s+#.*$/, "").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

const dump = fs.readFileSync("scripts/nov2024-blocks-dump.txt", "utf8");
const env = loadEnv();
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const prompt = `Build a JSON array of exactly 44 Digital SAT math questions from this Nov 2024 dump. Each object: module, position, kind, prompt, question_text, choices, correct_choice_id, correct_grid_answers.

Answers: M1=C,A,A,B,A,C,D,35,A,A,B,C,22,C,D,D,D,7.5,B,363,15100,-196; M2=B,C,A,A,C,D,B,B,B,-12,A,C,4,D,A,D,29,C,A,12.8,32/21,-37

Figure prompts use "[FIGURE NEEDED — add an image URL for this question]" for M1 1,8,10,13 and M2 7,11,21.
Reconstruct missing LaTeX equations. M2 Q10 is grid_in answer -12.

Return ONLY valid JSON array, no markdown.

${dump}`;

const r = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  config: { maxOutputTokens: 16000, temperature: 0.2 },
});

const text = r.text ?? "";
fs.writeFileSync("scripts/nov2024-gemini-raw.txt", text);
const json = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
try {
  const arr = JSON.parse(json);
  fs.writeFileSync("scripts/nov2024-questions.json", JSON.stringify(arr, null, 2));
  console.log("OK", arr.length);
} catch (e) {
  console.error("parse", e.message, text.slice(0, 200));
}
