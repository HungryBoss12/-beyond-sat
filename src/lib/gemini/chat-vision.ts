import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt, IMAGE_RECOGNITION_PROMPT } from "@/lib/ai/prompts";
import {
  resolveMaxTokens,
  EARLIER_IMAGE_PLACEHOLDER,
  type AiMessage,
  type AiSurface,
} from "@/lib/ai/router";
import { GEMINI_CHAT_VISION_MODEL, parseImageDataUrl } from "./config";
import { GeminiError, mapGeminiSdkError } from "./errors";

const VISION_TEMPERATURE = 0.3;
const RECOGNITION_MAX_TOKENS = 1200;

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

function sseChunk(delta: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`;
}

function sseDone(): string {
  return "data: [DONE]\n\n";
}

async function inlineImageFromUrl(url: string): Promise<{ mimeType: string; data: string }> {
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) {
    const { mimeType, buffer } = parseImageDataUrl(url);
    return { mimeType, data: buffer.toString("base64") };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new GeminiError("INVALID_IMAGE", "Could not load the attached image.", 400);
  }
  const mimeType = (response.headers.get("content-type") ?? "image/png").split(";")[0]?.trim();
  if (!/^image\//i.test(mimeType)) {
    throw new GeminiError("INVALID_IMAGE", "The image URL did not return an image.", 400);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { mimeType, data: buffer.toString("base64") };
}

async function toGeminiParts(content: AiMessage["content"]): Promise<GeminiPart[]> {
  if (typeof content === "string") return [{ text: content }];

  const parts: GeminiPart[] = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
      continue;
    }
    parts.push({ inlineData: await inlineImageFromUrl(part.image_url.url) });
  }
  return parts;
}

async function toGeminiContents(messages: AiMessage[]) {
  const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];
  for (const message of messages) {
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: await toGeminiParts(message.content),
    });
  }
  return contents;
}

async function describeOneImage(
  apiKey: string,
  model: string,
  imageUrl: string,
  userText: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const parts: GeminiPart[] = [{ text: IMAGE_RECOGNITION_PROMPT }];
  if (userText.trim()) parts.push({ text: `Student message: ${userText.trim()}` });
  parts.push({ inlineData: await inlineImageFromUrl(imageUrl) });

  try {
    const response = await ai.models.generateContent({
      model: model.trim() || GEMINI_CHAT_VISION_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.2,
        maxOutputTokens: RECOGNITION_MAX_TOKENS,
      },
    });
    const text = response.text?.trim();
    if (!text)
      throw new GeminiError("EMPTY_RESPONSE", "Gemini returned no image description.", 502);
    return text;
  } catch (error) {
    throw error instanceof GeminiError ? error : mapGeminiSdkError(error);
  }
}

/**
 * Replaces `image_url` parts on the latest user turn with Gemini descriptions.
 * Older image turns are stripped to text — follow-ups rely on prior assistant
 * replies for figure context, and are not re-sent to Gemini.
 */
export async function replaceImagesWithDescriptions(
  messages: AiMessage[],
  apiKey: string,
  model: string,
): Promise<AiMessage[]> {
  const lastIndex = messages.length - 1;
  const enriched: AiMessage[] = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    const isLatestUser = index === lastIndex && message.role === "user";
    const hasImages =
      typeof message.content !== "string" &&
      message.content.some((part) => part.type === "image_url");

    if (!hasImages || message.role !== "user") {
      enriched.push(message);
      continue;
    }

    const textParts = message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text);
    const imageParts = message.content.filter((part) => part.type === "image_url");
    const userText = textParts.join("\n").trim();

    if (!isLatestUser) {
      enriched.push({
        role: "user",
        content: userText || EARLIER_IMAGE_PLACEHOLDER,
      });
      continue;
    }

    const descriptions: string[] = [];
    for (const [imageIndex, part] of imageParts.entries()) {
      if (part.type !== "image_url") continue;
      const label = imageParts.length > 1 ? `Attached image ${imageIndex + 1}` : "Attached image";
      const description = await describeOneImage(apiKey, model, part.image_url.url, userText);
      descriptions.push(`${label}:\n${description}`);
    }

    const combined = [userText, ...descriptions].filter(Boolean).join("\n\n");
    enriched.push({ role: "user", content: combined });
  }
  return enriched;
}

export type GeminiVisionChatOptions = {
  apiKey: string;
  model: string;
  messages: AiMessage[];
  stream: boolean;
  surface: AiSurface;
};

export async function geminiVisionChatResponse(
  options: GeminiVisionChatOptions,
): Promise<Response> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new GeminiError(
      "MISSING_API_KEY",
      "GEMINI_API_KEY is not configured on the server.",
      503,
    );
  }

  const model = options.model.trim() || GEMINI_CHAT_VISION_MODEL;
  const contents = await toGeminiContents(options.messages);
  const ai = new GoogleGenAI({ apiKey });
  const config = {
    systemInstruction: buildSystemPrompt("vision"),
    temperature: VISION_TEMPERATURE,
    maxOutputTokens: resolveMaxTokens("vision", options.surface),
  };

  if (!options.stream) {
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({ model, contents, config });
      text = response.text;
    } catch (error) {
      throw mapGeminiSdkError(error);
    }
    return new Response(JSON.stringify({ content: typeof text === "string" ? text : "" }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await ai.models.generateContentStream({ model, contents, config });
        for await (const chunk of response) {
          const delta = chunk.text;
          if (delta) controller.enqueue(encoder.encode(sseChunk(delta)));
        }
        controller.enqueue(encoder.encode(sseDone()));
        controller.close();
      } catch (error) {
        const mapped = error instanceof GeminiError ? error : mapGeminiSdkError(error);
        console.error(`[ai] gemini vision stream failed: ${mapped.message}`);
        controller.error(mapped);
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
