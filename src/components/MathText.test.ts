import { describe, expect, it } from "vitest";
import { normalizeMathInput, renderMathText } from "./MathText";

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

  it("renders nth-root with radical SVG markup", () => {
    const html = renderMathText("$\\sqrt[3]{117n}(\\sqrt[5]{117n})^{2}$");
    expect(html).toContain("katex");
    expect(html).toContain("sqrt");
    // KaTeX 0.18 uses .hide-tail + svg for the radical; older used .sqrt-sign
    expect(html).toMatch(/hide-tail|sqrt-sign/);
    expect(html).toContain("<svg");
  });

  it("does not treat currency $digits as math open", () => {
    const src =
      "Together, they save a total of $3,270 from their monthly salaries each month. If $h$ and $w$ represent Hannah's and Wyatt's monthly salaries, in dollars, respectively, which equation shows the relationship between $h$ and $w$?";
    const html = renderMathText(src);
    expect(html).toContain("from their monthly salaries");
    expect(html).not.toMatch(/fromtheirmonthlysalaries/);
    expect(html).toContain("$3,270");
    expect(html).toContain("katex");
  });

  it("heals broken \\3{,}270 currency artifacts", () => {
    const normalized = normalizeMathInput("a total of \\3{,}270 from their");
    // Healed to currency then protected (private-use placeholder + digits)
    expect(normalized).toMatch(/[\uE000$]3\{,\}270/);
    expect(normalized).not.toContain("\\3");
    const html = renderMathText("a total of \\3{,}270 from their monthly salaries");
    expect(html).toContain("from their monthly");
    expect(html).toContain("$3{,}270");
    expect(html).not.toContain("\\3");
  });

  it("still allows real math that starts with a digit", () => {
    const html = renderMathText("Solve $3x+1=7$.");
    expect(html).toContain("katex");
  });

  it("still allows decimal math like $196.74$", () => {
    const html = renderMathText("The value is $196.74$ dollars in math mode.");
    expect(html).toContain("katex");
    expect(html).not.toMatch(/\.74\$/);
    expect(normalizeMathInput("$196.74$")).toBe("$196.74$");
    expect(normalizeMathInput("$2.02$")).toBe("$2.02$");
  });

  it("still protects decimal currency in prose", () => {
    const html = renderMathText("She paid $196.74 from her account. If $x$ is…");
    expect(html).toContain("$196.74");
    expect(html).toContain("from her account");
    expect(html).toContain("katex");
  });

  it("still escapes unsafe markup", () => {
    expect(renderMathText("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("latexifies plain slash fractions for display", () => {
    const html = renderMathText(
      "If 2a/b = 5.8 and a/(bn) = 23.2, what is the value of 1/n?",
    );
    expect(html).toContain("katex");
    expect(html).not.toMatch(/2a\/b/);
  });
});
