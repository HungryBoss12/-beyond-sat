import { describe, expect, it } from "vitest";
import {
  buildSearchQuery,
  formatYoutubePromptBlock,
  latestUserText,
  parseApiKeys,
  parseIsoDuration,
  videoIntent,
} from "./search";

describe("parseApiKeys", () => {
  it("splits newlines and commas, trims, and dedupes", () => {
    expect(parseApiKeys(" AIza1 \nAIza2,AIza1\n\n")).toEqual(["AIza1", "AIza2"]);
  });

  it("returns empty for blank input", () => {
    expect(parseApiKeys("")).toEqual([]);
    expect(parseApiKeys(null)).toEqual([]);
  });
});

describe("videoIntent", () => {
  it("ignores ordinary study questions", () => {
    expect(videoIntent("How do I solve this quadratic?")).toBe("none");
  });

  it("detects a video request", () => {
    expect(videoIntent("Can you recommend a YouTube video for algebra?")).toBe("use");
    expect(videoIntent("I want to watch a lesson")).toBe("use");
  });

  it("detects a refresh request", () => {
    expect(videoIntent("Show me different videos")).toBe("refresh");
    expect(videoIntent("Any other YouTube recommendations?")).toBe("refresh");
  });
});

describe("buildSearchQuery", () => {
  it("picks a skill from UInfo or the latest message", () => {
    expect(buildSearchQuery("Student is weak in algebra.")).toBe("Digital SAT algebra practice");
    expect(buildSearchQuery("", "need grammar videos")).toBe("Digital SAT grammar writing");
  });

  it("falls back to a generic SAT query", () => {
    expect(buildSearchQuery("")).toBe("Digital SAT practice lesson");
  });
});

describe("parseIsoDuration", () => {
  it("parses YouTube ISO-8601 durations", () => {
    expect(parseIsoDuration("PT15M3S")).toBe(903);
    expect(parseIsoDuration("PT1H2M")).toBe(3720);
    expect(parseIsoDuration("bad")).toBeNull();
  });
});

describe("formatYoutubePromptBlock", () => {
  it("returns empty when there are no videos", () => {
    expect(formatYoutubePromptBlock([])).toBe("");
  });

  it("lists real URLs only", () => {
    const block = formatYoutubePromptBlock([
      {
        title: "Algebra",
        url: "https://www.youtube.com/watch?v=abc123",
        channel: "SAT Prep",
        videoId: "abc123",
        durationSeconds: 600,
      },
    ]);
    expect(block).toContain("YouTube picks");
    expect(block).toContain("https://www.youtube.com/watch?v=abc123");
    expect(block).toContain("SAT Prep");
  });
});

describe("latestUserText", () => {
  it("reads the last user turn", () => {
    expect(
      latestUserText([
        { role: "assistant", content: "hi" },
        { role: "user", content: "recommend a video" },
      ]),
    ).toBe("recommend a video");
  });
});
