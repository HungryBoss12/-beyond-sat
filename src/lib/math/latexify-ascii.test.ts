import { describe, expect, it } from "vitest";
import { latexifyAsciiMath } from "./latexify-ascii";

describe("latexifyAsciiMath", () => {
  it("converts slash fractions like 2a/b and a/(bn)", () => {
    const out = latexifyAsciiMath(
      "If 2a/b = 5.8 and a/(bn) = 23.2, what is the value of 1/n?",
    );
    expect(out).toContain("$\\frac{2a}{b}$");
    expect(out).toContain("$\\frac{a}{bn}$");
    expect(out).toContain("$\\frac{1}{n}$");
  });

  it("leaves existing $ math alone", () => {
    expect(latexifyAsciiMath("Solve $3x+1=7$.")).toBe("Solve $3x+1=7$.");
  });

  it("wraps f(20) and unicode sqrt", () => {
    expect(latexifyAsciiMath("What is the value of f(20)?")).toContain("$f(20)$");
    expect(latexifyAsciiMath("f(x) = 8 + √x")).toContain("$\\sqrt{x}$");
  });

  it("converts cm² and ⅓", () => {
    expect(latexifyAsciiMath("area in cm²")).toContain("\\mathrm{cm}^{2}");
    expect(latexifyAsciiMath("radius is ⅓ the")).toContain("\\frac{1}{3}");
  });

  it("wraps multi-term equations without splitting", () => {
    expect(latexifyAsciiMath("2x - 8y = 5")).toBe("$2x - 8y = 5$");
    expect(latexifyAsciiMath("3x - 4y = 5\nx = 7")).toContain("$3x - 4y = 5$");
  });
  it("does not rewrite English and/or", () => {
    expect(latexifyAsciiMath("yes and/or no")).toBe("yes and/or no");
  });
});
