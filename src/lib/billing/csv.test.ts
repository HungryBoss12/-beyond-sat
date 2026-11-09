import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("keeps text that a spreadsheet would run as a formula as plain text", () => {
    expect(toCsv([['=HYPERLINK("http://x")', "+1+1", "@SUM(A1)", "-2+3"]])).toBe(
      `"'=HYPERLINK(""http://x"")",'+1+1,'@SUM(A1),'-2+3`,
    );
  });

  it("leaves signed amounts as numbers", () => {
    expect(toCsv([["-5000", -5000, "1200"]])).toBe("-5000,-5000,1200");
  });
});
