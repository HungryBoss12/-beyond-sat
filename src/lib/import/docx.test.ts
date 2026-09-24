import { describe, expect, it } from "vitest";
import { ommlBlockToLatex } from "./docx";

describe("ommlBlockToLatex", () => {
  it("converts fractions", () => {
    const xml = `<m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f>`;
    expect(ommlBlockToLatex(xml)).toBe("\\frac{1}{2}");
  });

  it("converts superscripts", () => {
    const xml = `<m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>`;
    expect(ommlBlockToLatex(xml)).toBe("x^{2}");
  });

  it("converts square roots", () => {
    const xml = `<m:rad><m:e><m:r><m:t>9</m:t></m:r></m:e></m:rad>`;
    expect(ommlBlockToLatex(xml)).toBe("\\sqrt{9}");
  });

  it("converts nth roots with degree", () => {
    const xml = `<m:rad><m:deg><m:r><m:t>3</m:t></m:r></m:deg><m:e><m:r><m:t>117n</m:t></m:r></m:e></m:rad>`;
    expect(ommlBlockToLatex(xml)).toBe("\\sqrt[3]{117n}");
  });
});
