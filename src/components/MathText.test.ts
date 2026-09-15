import { describe, expect, it } from "vitest";
import { renderMathText } from "./MathText";

describe("MathText", () => {
  it("renders <u> tags as HTML underlines", () => {
    expect(renderMathText("As used in the text, <u>surveyed</u> most nearly means")).toContain(
      "<u>surveyed</u>",
    );
    expect(renderMathText("As used in the text, <u>surveyed</u> most nearly means")).not.toContain(
      "&lt;u&gt;",
    );
  });

  it("decodes entity-encoded underline tags", () => {
    expect(renderMathText("The word &lt;u&gt;test&lt;/u&gt; here")).toContain("<u>test</u>");
  });

  it("strips attributes from underline open tags", () => {
    expect(renderMathText('<u class="foo">word</u>')).toBe("<u>word</u>");
  });

  it("renders sqrt inside $...$ as KaTeX HTML", () => {
    const html = renderMathText("$6\\sqrt{3}$");
    expect(html).toContain("katex");
    expect(html).toContain("sqrt");
    expect(html).toMatch(/<svg|√/);
  });

  it("still escapes unsafe markup", () => {
    expect(renderMathText("<script>alert(1)</script>")).not.toContain("<script>");
  });
});
