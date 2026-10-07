import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS, isAllowedImageUrl, normalizeMessages, resolveModel, storageHostFromUrl } from "./router";

describe("resolveModel", () => {
  it("ignores Gemini-style and embedding IDs on OpenRouter tasks", () => {
    expect(
      resolveModel("quick", { openrouter_model_quick: "gemini-3.8-flash" }),
    ).toBe(DEFAULT_MODELS.quick);
    expect(
      resolveModel("reasoning", {
        openrouter_model_reasoning: "nvidia/nemotron-3-embed-1b:free",
      }),
    ).toBe(DEFAULT_MODELS.reasoning);
  });

  it("keeps a real OpenRouter chat id", () => {
    expect(
      resolveModel("chat", {
        openrouter_model_chat: "nvidia/nemotron-3-super-120b-a12b:free",
      }),
    ).toBe("nvidia/nemotron-3-super-120b-a12b:free");
  });
});

const HOST = "qlzvngegsemrzmyxwykl.supabase.co";

describe("isAllowedImageUrl", () => {
  it("accepts a data image and this project's storage object", () => {
    expect(isAllowedImageUrl("data:image/png;base64,aaaa", HOST)).toBe(true);
    expect(
      isAllowedImageUrl(
        `https://${HOST}/storage/v1/object/sign/question-images/a.png?token=1`,
        HOST,
      ),
    ).toBe(true);
    expect(storageHostFromUrl(`https://${HOST}`)).toBe(HOST);
  });

  it("rejects other https hosts and a storage path on a different project", () => {
    expect(isAllowedImageUrl("https://example.com/a.png", HOST)).toBe(false);
    expect(isAllowedImageUrl("http://169.254.169.254/latest/meta-data", HOST)).toBe(false);
    expect(
      isAllowedImageUrl("https://other.supabase.co/storage/v1/object/public/question-images/a.png", HOST),
    ).toBe(false);
    const blocked = normalizeMessages(
      [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "https://example.com/a.png" } }],
        },
      ],
      { storageHost: HOST },
    );
    expect("error" in blocked).toBe(true);
  });
});
