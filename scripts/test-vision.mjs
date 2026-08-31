import fs from "fs";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { GoogleGenAI } from "@google/genai";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        const k = l.slice(0, i).trim();
        let v = l.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [k, v];
      }),
  );
}

const env = loadEnv();
const data = new Uint8Array(fs.readFileSync("c:/Users/javaz/Downloads/DSAT March 2024.pdf"));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
const page = await doc.getPage(21);
const vp = page.getViewport({ scale: 1.6 });
const canvas = createCanvas(Math.floor(vp.width), Math.floor(vp.height));
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#fff";
ctx.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: ctx, viewport: vp }).promise;
const b64 = canvas.toBuffer("image/jpeg", { quality: 0.72 }).toString("base64");

try {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const r = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: "Return []" }] }],
  });
  console.log("GEMINI_OK", r.text?.slice(0, 30));
} catch (e) {
  console.log("GEMINI_FAIL", e.status, String(e.message).slice(0, 150));
}

for (const model of ["dots-studio/dots-3-note-preview:free", "deepseek/deepseek-v4-flash-vision-exp"]) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Return JSON array of SAT questions on this page." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content ?? "";
  console.log(model, res.status, "len", text.length, text.slice(0, 120));
}

await doc.destroy();
