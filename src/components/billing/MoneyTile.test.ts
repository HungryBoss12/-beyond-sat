import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wallet } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MoneyTile } from "./MoneyTile";

function render(amount: bigint): string {
  return renderToStaticMarkup(
    createElement(
      TooltipProvider,
      null,
      createElement(MoneyTile, { icon: Wallet, label: "Current balance", amount, kind: "debt" }),
    ),
  );
}

describe("MoneyTile", () => {
  it("keeps a 12-digit amount inside the card", () => {
    const html = render(999999999999n);
    // The visible text is the short form, so the digits can't stretch the tile.
    expect(html).toContain("1 trln UZS");
    expect(html).not.toContain(">999 999 999 999 UZS<");
    // The full amount stays reachable: the accessible name and the truncation hooks.
    expect(html).toContain('aria-label="Current balance: 999 999 999 999 UZS debt"');
    expect(html).toContain("min-w-0");
    expect(html).toContain("truncate");
    expect(html).toContain("tabular-nums");
  });
});
