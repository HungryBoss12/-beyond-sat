import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS, resolveModel } from "./router";

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
