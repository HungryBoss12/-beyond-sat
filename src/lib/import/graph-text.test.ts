import { describe, expect, it } from "vitest";
import { extractGraphText, graphMarkdownBlock, replaceGraphText } from "./graph-text";

const GRAPH = "x-axis: Time, 0 to 10\ny-axis: Speed, 0 to 60\npoints: (0, 0); (2, 10)\nlines: a straight line through those points";

describe("graph text", () => {
  it("stores a graph block in the passage", () => {
    const prompt = replaceGraphText("Read the graph.", GRAPH);
    expect(prompt).toContain("[Graph]");
    expect(prompt).toContain("Read the graph.");
    expect(extractGraphText(prompt)).toBe(GRAPH);
    expect(graphMarkdownBlock(GRAPH)).toBe(`[Graph]\n${GRAPH}\n[/Graph]`);
  });

  it("edits the graph without wiping the rest of the passage", () => {
    const original = replaceGraphText("The table is above.\n\nThen the stem context.", GRAPH);
    const next = replaceGraphText(original, "x-axis: Hours\ny-axis: Miles\npoints: (1, 2)\nlines: rising");
    expect(next).toContain("The table is above.");
    expect(next).toContain("Then the stem context.");
    expect(extractGraphText(next)).toBe("x-axis: Hours\ny-axis: Miles\npoints: (1, 2)\nlines: rising");
    expect(replaceGraphText(next, "")).toBe("The table is above.\n\nThen the stem context.");
  });
});
