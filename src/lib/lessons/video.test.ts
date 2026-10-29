import { afterEach, describe, expect, it, vi } from "vitest";
import { youtubeEmbed, youtubeId, youtubePlaylistEmbed } from "./video";

describe("youtubeId", () => {
  it("parses watch, share, embed, and Shorts URLs", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(youtubeId("https://youtu.be/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
  });
});

describe("youtube embeds", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the page origin so the player never falls back to file://", () => {
    vi.stubGlobal("window", { location: { protocol: "https:", origin: "https://beyondsat.uz" } });
    const video = youtubeEmbed("https://www.youtube.com/watch?v=dQw4w9wgGcQ", { autoplay: false });
    const list = youtubePlaylistEmbed("https://www.youtube.com/playlist?list=PL1234567890");
    expect(video).toContain("origin=https%3A%2F%2Fbeyondsat.uz");
    expect(video).not.toContain("file:");
    expect(list).toContain("origin=https%3A%2F%2Fbeyondsat.uz");
    expect(list).not.toContain("file:");
  });

  it("omits origin when the page itself is a file url", () => {
    vi.stubGlobal("window", { location: { protocol: "file:", origin: "null" } });
    const video = youtubeEmbed("https://www.youtube.com/watch?v=dQw4w9wgGcQ", { autoplay: false });
    expect(video).toBe("https://www.youtube-nocookie.com/embed/dQw4w9wgGcQ");
  });
});
