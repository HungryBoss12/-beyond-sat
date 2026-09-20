import { describe, expect, it } from "vitest";
import {
  buildSearchQuery,
  filterCrossSection,
  formatYoutubePromptBlock,
  latestUserText,
  parseApiKeys,
  parseIsoDuration,
  parseYoutubeSection,
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

describe("parseYoutubeSection", () => {
  it("accepts rw and math (case-insensitive)", () => {
    expect(parseYoutubeSection("rw")).toBe("rw");
    expect(parseYoutubeSection("MATH")).toBe("math");
  });

  it("rejects unknown or missing values", () => {
    expect(parseYoutubeSection("english")).toBeNull();
    expect(parseYoutubeSection(null)).toBeNull();
    expect(parseYoutubeSection("")).toBeNull();
  });
});

describe("buildSearchQuery with section", () => {
  it("keeps in-section skill hits", () => {
    expect(buildSearchQuery("weak in algebra", "", "math")).toBe("Digital SAT algebra practice");
    expect(buildSearchQuery("", "grammar help", "rw")).toBe("Digital SAT grammar writing");
  });

  it("never crosses sections on out-of-section skill mentions", () => {
    // uinfo mentions algebra but the page is RW → pinned RW query.
    expect(buildSearchQuery("weak in algebra", "", "rw")).toBe(
      "Digital SAT reading writing grammar lesson",
    );
    // uinfo mentions grammar but the page is Math → pinned Math query.
    expect(buildSearchQuery("struggles with grammar", "", "math")).toBe(
      "Digital SAT math algebra practice lesson",
    );
  });

  it("falls back to the pinned section query with empty uinfo", () => {
    expect(buildSearchQuery("", "", "math")).toBe("Digital SAT math algebra practice lesson");
    expect(buildSearchQuery("", "", "rw")).toBe("Digital SAT reading writing grammar lesson");
  });
});

describe("filterCrossSection", () => {
  const algebraVideo = {
    title: "Algebra basics",
    url: "u1",
    channel: "c",
    videoId: "v1",
    durationSeconds: null,
  };
  const grammarVideo = {
    title: "SAT grammar tips",
    url: "u2",
    channel: "c",
    videoId: "v2",
    durationSeconds: null,
  };

  it("drops off-section titles on RW pages", () => {
    const out = filterCrossSection([algebraVideo, grammarVideo], "rw");
    expect(out.map((v) => v.videoId)).toEqual(["v2"]);
  });

  it("drops off-section titles on Math pages", () => {
    const out = filterCrossSection([algebraVideo, grammarVideo], "math");
    expect(out.map((v) => v.videoId)).toEqual(["v1"]);
  });

  it("is a no-op without a section and never returns empty", () => {
    expect(filterCrossSection([algebraVideo, grammarVideo], null)).toHaveLength(2);
    expect(filterCrossSection([algebraVideo], "rw")).toHaveLength(1); // fallback keeps 1
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
