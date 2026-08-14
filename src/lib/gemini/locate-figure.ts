import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt, FIGURE_LOCATE_PROMPT } from "@/lib/ai/prompts";
import {
  GEMINI_IMPORT_EXTRACT_MODEL,
  GEMINI_IMPORT_TEMPERATURE,
  GEMINI_IMPORT_THINKING,
  parseImageDataUrl,
} from "./config";
import { GeminiError, mapGeminiSdkError } from "./errors";

export type FigureQuestionHint = {
  draft_number: number;
  stem: string;
};

export type LocateFigureOptions = {
  apiKey: string;
  hint?: string;
  questions?: FigureQuestionHint[];
  /** When true, ask Gemini to also return markdown for table boxes. */
  tableMarkdown?: boolean;
};

function formatQuestionsList(questions: FigureQuestionHint[] | undefined): string {
  if (!questions?.length) return "";
  const lines = questions
    .map((q) => `- draft_number ${q.draft_number}: ${q.stem || "(no stem)"}`)
    .join("\n");
  return `\n\nQuestions on this page (assign each figure box to one draft_number):\n${lines}`;
}

const TABLE_MARKDOWN_NOTE = `

For every box with kind "table", also fill "markdown" with a faithful GitHub-flavored markdown table of the visible cells (headers + rows). Keep numbers exact. Do not invent missing cells — use empty cells if unreadable. For non-table kinds leave markdown empty.`;

/** Locate figures on one page with Gemini vision (single pass). */
export async function locateFiguresOnPage(
  imageDataUrl: string,
  options: LocateFigureOptions,
): Promise<string> {
  const hint = options.hint?.trim()
    ? `\n\nExtra figure note: ${options.hint.trim()}`
    : "";
  const questionsBlock = formatQuestionsList(options.questions);
  const markdownNote = options.tableMarkdown ? TABLE_MARKDOWN_NOTE : "";

  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new GeminiError(
      "MISSING_API_KEY",
      "GEMINI_API_KEY is not configured on the server.",
      503,
    );
  }

  let mimeType: string;
  let buffer: Buffer;
  try {
    ({ mimeType, buffer } = parseImageDataUrl(imageDataUrl));
  } catch (error) {
    throw new GeminiError(
      "INVALID_IMAGE",
      error instanceof Error ? error.message : "Invalid image data URL.",
    );
  }

  if (!buffer.length) {
    throw new GeminiError("INVALID_IMAGE", "Image data URL is empty.");
  }

  const userParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: `${FIGURE_LOCATE_PROMPT}${questionsBlock}${hint}${markdownNote}` },
    {
      inlineData: {
        mimeType,
        data: buffer.toString("base64"),
      },
    },
  ];

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMPORT_EXTRACT_MODEL,
      contents: [{ role: "user", parts: userParts }],
      config: {
        systemInstruction: buildSystemPrompt("vision"),
        temperature: GEMINI_IMPORT_TEMPERATURE,
        maxOutputTokens: 2048,
        thinkingConfig: GEMINI_IMPORT_THINKING,
        responseMimeType: "application/json",
      },
    });
    text = response.text?.trim();
  } catch (error) {
    throw mapGeminiSdkError(error);
  }

  if (!text) {
    throw new GeminiError("EMPTY_RESPONSE", "Gemini returned no content.", 502);
  }

  return text;
}
