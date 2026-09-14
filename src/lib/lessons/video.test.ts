import { describe, expect, it } from "vitest";
import { youtubeId } from "./video";

describe("youtubeId", () => {
  it("parses watch, share, embed, and Shorts URLs", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(youtubeId("https://youtu.be/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
  });
});
