import { describe, expect, it } from "vitest";
import {
  firstLine,
  guessPartOfSpeech,
  parseSynonymsField,
  stripAnkiHtml,
} from "./anki-html";
import { isAnkiStubNote, mapAnkiNoteToVocabItem } from "./parse-apkg";

describe("isAnkiStubNote", () => {
  it("detects Anki migration placeholder text", () => {
    expect(
      isAnkiStubNote(
        "Please update to the latest Anki version, then import the .colpkg/.apkg file again.",
        "",
      ),
    ).toBe(true);
  });

  it("allows real vocabulary", () => {
    expect(isAnkiStubNote("ephemeral", "lasting for a very short time")).toBe(false);
  });
});

describe("stripAnkiHtml", () => {
  it("removes simple tags", () => {
    expect(stripAnkiHtml("<b>ephemeral</b>")).toBe("ephemeral");
  });
});

describe("mapAnkiNoteToVocabItem", () => {
  it("maps basic front/back fields", () => {
    const item = mapAnkiNoteToVocabItem({
      flds: "ephemeral\x1flasting for a very short time",
      tags: "sat vocab",
      model: { name: "Basic", flds: [{ name: "Front" }, { name: "Back" }] },
    });
    expect(item?.word).toBe("ephemeral");
    expect(item?.definition).toContain("short time");
    expect(item?.partOfSpeech).toBe("noun");
  });

  it("uses Extra field for synonyms", () => {
    const item = mapAnkiNoteToVocabItem({
      flds: "malleable\x1fable to be shaped\x1fflexible, pliable",
      tags: "",
      model: {
        flds: [{ name: "Word" }, { name: "Definition" }, { name: "Extra" }],
      },
    });
    expect(item?.synonyms).toEqual(["flexible", "pliable"]);
  });

  it("swaps VOCABOOK fields when Word holds the clue and Definition holds the term", () => {
    const item = mapAnkiNoteToVocabItem({
      flds: "Unpredictable, inconsistent, irregular\x1fErratic\x1fExample sentence here.",
      tags: "",
      model: {
        name: "VOCABOOK 4F (Word→Definition)",
        flds: [{ name: "Word" }, { name: "Definition" }, { name: "Example" }],
      },
    });
    expect(item?.word).toBe("Erratic");
    expect(item?.definition).toContain("Unpredictable");
  });

  it("returns null for empty notes", () => {
    expect(
      mapAnkiNoteToVocabItem({
        flds: "\x1f",
        tags: "",
        model: { flds: [{ name: "Front" }, { name: "Back" }] },
      }),
    ).toBeNull();
  });

  it("skips Anki stub placeholder notes", () => {
    expect(
      mapAnkiNoteToVocabItem({
        flds: "Please update to the latest Anki version, then import the .colpkg/.apkg file again.\x1f",
        tags: "",
        model: { flds: [{ name: "Front" }, { name: "Back" }] },
      }),
    ).toBeNull();
  });
});

describe("guessPartOfSpeech", () => {
  it("reads tag hints", () => {
    expect(guessPartOfSpeech("sat adj", "(v.) to run")).toBe("adjective");
  });
});

describe("firstLine", () => {
  it("takes the first line only", () => {
    expect(firstLine("word\nextra line")).toBe("word");
  });
});

describe("parseSynonymsField", () => {
  it("splits on commas", () => {
    expect(parseSynonymsField("a, b, c")).toEqual(["a", "b", "c"]);
  });
});
