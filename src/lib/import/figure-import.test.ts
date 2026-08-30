import { describe, expect, it } from "vitest";
import {
  boxesForDraft,
  filterConfidentBoxes,
  padForKind,
  parseFigureBoxes,
  unionBoxesForDraft,
} from "./crop-figure";
import { diffRec } from "./activity-log";
import { figureDependencyError, figureDependencyReason, needsFigure } from "./figure-dependency";
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

describe("figure kind, confidence, pad", () => {
  it("parses kind, confidence, and markdown", () => {
    const json = `{"figures":[{"draft_number":3,"kind":"table","confidence":0.88,"x":0.1,"y":0.2,"w":0.5,"h":0.3,"markdown":"| a | b |\\n|---|---|\\n| 1 | 2 |"}]}`;
    const boxes = parseFigureBoxes(json);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].kind).toBe("table");
    expect(boxes[0].confidence).toBe(0.88);
    expect(boxes[0].markdown).toContain("| a | b |");
  });

  it("filters low-confidence boxes", () => {
    const json = `{"figures":[{"draft_number":1,"confidence":0.2,"x":0.1,"y":0.1,"w":0.2,"h":0.2},{"draft_number":2,"confidence":0.9,"x":0.4,"y":0.1,"w":0.2,"h":0.2},{"draft_number":3,"x":0.7,"y":0.1,"w":0.2,"h":0.2}]}`;
    const boxes = filterConfidentBoxes(parseFigureBoxes(json));
    expect(boxes.map((b) => b.draft_number)).toEqual([2, 3]);
  });

  it("uses wider horizontal pad for tables", () => {
    expect(padForKind("table").x).toBeGreaterThan(padForKind("figure").x);
    expect(padForKind("graph").y).toBeGreaterThan(padForKind("figure").y);
  });

  it("preserves kind when unioning", () => {
    const json = `{"figures":[{"draft_number":1,"kind":"graph","confidence":0.7,"x":0.1,"y":0.1,"w":0.1,"h":0.1},{"draft_number":1,"kind":"graph","confidence":0.9,"x":0.2,"y":0.1,"w":0.1,"h":0.1}]}`;
    const u = unionBoxesForDraft(parseFigureBoxes(json), 1);
    expect(u?.kind).toBe("graph");
    expect(u?.confidence).toBe(0.7);
  });
});

describe("diffRec", () => {
  it("reports changed keys only", () => {
    const diffs = diffRec(
      { question_text: "old", correct: "A", prompt: "" },
      { question_text: "new", correct: "A", prompt: "hi" },
    );
    expect(diffs.map((d) => d.key).sort()).toEqual(["prompt", "question_text"]);
    expect(diffs.find((d) => d.key === "question_text")).toEqual({
      key: "question_text",
      before: "old",
      after: "new",
    });
  });
});
