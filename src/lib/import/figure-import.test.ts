import { describe, expect, it } from "vitest";
import {
  boxesForDraft,
  parseFigureBoxes,
  unionBoxesForDraft,
} from "./crop-figure";
import {
  figureDependencyError,
  figureDependencyReason,
  needsFigure,
} from "./figure-dependency";
import type { Draft } from "./parse";

describe("figureDependencyReason", () => {
  it("detects explicit markers", () => {
    const rec = { prompt: "Notes\n[FIGURE NEEDED: bar graph of sales]" };
    expect(figureDependencyReason(rec)).toBe("marker");
  });

  it("detects strong figure phrases", () => {
    const rec = { question_text: "What is the slope shown in the graph?" };
    expect(figureDependencyReason(rec)).toBe("phrase");
  });

  it("returns null when image_url is set", () => {
    const rec = {
      prompt: "[FIGURE NEEDED: diagram]",
      image_url: "https://example.com/x.png",
    };
    expect(figureDependencyReason(rec)).toBeNull();
  });
});

describe("figureDependencyError", () => {
  it("blocks markers on any import", () => {
    expect(
      figureDependencyError({ prompt: "[FIGURE NEEDED: table]" }, { fileImport: false }),
    ).toBeTruthy();
  });

  it("blocks phrases only for file imports", () => {
    const rec = { question_text: "Refer to the figure above." };
    expect(figureDependencyError(rec, { fileImport: false })).toBeNull();
    expect(figureDependencyError(rec, { fileImport: true })).toBeTruthy();
  });
});

describe("needsFigure", () => {
  it("uses shared detection on drafts", () => {
    const draft: Draft = {
      number: 3,
      rec: { question_text: "Based on the coordinate plane shown, what is x?" },
      warnings: [],
    };
    expect(needsFigure(draft)).toBe(true);
  });
});

describe("parseFigureBoxes draft_number", () => {
  const sample = `{"figures":[{"draft_number":2,"x":0.1,"y":0.2,"w":0.3,"h":0.4},{"draft_number":5,"x":0.5,"y":0.1,"w":0.2,"h":0.2}]}`;

  it("parses draft_number on each box", () => {
    const boxes = parseFigureBoxes(sample);
    expect(boxes).toHaveLength(2);
    expect(boxes[0].draft_number).toBe(2);
    expect(boxes[1].draft_number).toBe(5);
  });

  it("assigns only matching boxes per draft", () => {
    const boxes = parseFigureBoxes(sample);
    expect(boxesForDraft(boxes, 2)).toHaveLength(1);
    expect(boxesForDraft(boxes, 5)).toHaveLength(1);
    expect(boxesForDraft(boxes, 9)).toHaveLength(0);
  });

  it("unions multiple boxes for the same draft only", () => {
    const json = `{"figures":[{"draft_number":1,"x":0.1,"y":0.1,"w":0.1,"h":0.1},{"draft_number":1,"x":0.3,"y":0.1,"w":0.1,"h":0.1},{"draft_number":2,"x":0.6,"y":0.1,"w":0.2,"h":0.2}]}`;
    const boxes = parseFigureBoxes(json);
    const q1 = unionBoxesForDraft(boxes, 1);
    const q2 = unionBoxesForDraft(boxes, 2);
    expect(q1).not.toBeNull();
    expect(q2).not.toBeNull();
    expect(q1!.x).toBeLessThan(0.2);
    expect(q2!.x).toBeGreaterThan(0.5);
  });
});
