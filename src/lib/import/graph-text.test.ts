import { describe, expect, it } from "vitest";
import {
  blankGraph,
  extractGraphText,
  graphMarkdownBlock,
  parseGraph,
  replaceGraphText,
  serializeGraph,
  studentSeesGraph,
} from "./graph-text";

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

  it("round-trips a graph, hides a legacy block, shows a blank graph, and clears the block", () => {
    const graph = {
      xLabel: "Time",
      xMin: "0",
      xMax: "10",
      xTicks: "0, 2, 4",
      yLabel: "Speed",
      yMin: "0",
      yMax: "60",
      yTicks: "",
      points: [
        { x: "0", y: "0" },
        { x: "2", y: "10" },
      ],
      lines: "a straight line through those points",
      draw: "line" as const,
      grid: true,
      show: true,
    };
    expect(parseGraph(serializeGraph(graph))).toEqual(graph);

    const legacy = replaceGraphText("Read the graph.", GRAPH);
    expect(studentSeesGraph(legacy)).toBeNull();

    expect(parseGraph(serializeGraph(blankGraph()))).toEqual(blankGraph());
    const shown = replaceGraphText("Read the graph.", serializeGraph(blankGraph()));
    expect(studentSeesGraph(shown)).toEqual(blankGraph());
    expect(studentSeesGraph(replaceGraphText(shown, ""))).toBeNull();
    expect(replaceGraphText(shown, "")).toBe("Read the graph.");
  });
});
