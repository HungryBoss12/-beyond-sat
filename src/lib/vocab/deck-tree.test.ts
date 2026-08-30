import { describe, expect, it } from "vitest";
import { buildDeckTreeFromAnki, markFoldersWithChildren } from "./deck-tree";
import type { AnkiDeckNode } from "./types";

const DECK_SEP = "\u001f";

describe("buildDeckTreeFromAnki", () => {
  it("marks VOCABOOK root as folder when it has children", () => {
    const rows = [
      {
        id: 1,
        name: `VOCABOOK by @satashkent${DECK_SEP}College Panda${DECK_SEP}Definition→Word`,
      },
      {
        id: 2,
        name: `VOCABOOK by @satashkent${DECK_SEP}Ivy Global${DECK_SEP}Definition→Word`,
      },
    ];
    const tree = buildDeckTreeFromAnki(rows);
    const root = tree.find((n) => n.title === "VOCABOOK by @satashkent");
    expect(root?.isFolder).toBe(true);
    const college = tree.find((n) => n.title === "College Panda");
    expect(college?.isFolder).toBe(true);
  });

  it("markFoldersWithChildren promotes parents with child references", () => {
    const nodes = new Map<string, AnkiDeckNode>([
      [
        "root",
        { path: "root", title: "Root", parentPath: null, sortOrder: 0, isFolder: false },
      ],
      [
        "root::child",
        { path: "root::child", title: "Child", parentPath: "root", sortOrder: 1, isFolder: false },
      ],
    ]);
    markFoldersWithChildren(nodes);
    expect(nodes.get("root")?.isFolder).toBe(true);
  });
});
