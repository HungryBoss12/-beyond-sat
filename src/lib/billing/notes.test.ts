import { describe, expect, it } from "vitest";
import { staffName } from "@/lib/people-name";
import { subgroupNote } from "@/lib/billing/notes";

describe("staff names", () => {
  it("uses the name and surname, not the username", () => {
    expect(
      staffName({
        first_name: "Sanjar",
        last_name: "Hasanov",
        full_name: "hasanov_s",
      }),
    ).toBe("Sanjar Hasanov");
    expect(staffName({ full_name: "Musulmonova Farzona" })).toBe("Musulmonova Farzona");
    expect(staffName(null)).toBe("Student");
  });
});

describe("fee notes", () => {
  it("replaces the class name with the sub-groups", () => {
    expect(
      subgroupNote("Course fee · October 2026 · SAT 13 · 22/27 lessons", [
        "SAT 13 Eng",
        "SAT 13 Maths",
      ]),
    ).toBe("Course fee · October 2026 · SAT 13 Eng + SAT 13 Maths · 22/27 lessons");
    expect(subgroupNote("Payment", ["SAT 13 Eng"])).toBe("Payment");
  });
});
