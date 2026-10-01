import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Gauge } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton } from "./icon-button";

function buttonsWithoutName(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = match[1] ?? "";
    const text = (match[2] ?? "").replace(/<[^>]+>/g, "").trim();
    if (!/aria-label="[^"]+"/.test(attrs) && !text) out.push(match[0]);
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("IconButton", () => {
  it("renders an accessible name and the pressed state", () => {
    const html = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(IconButton, { icon: Gauge, label: "Edit levels", pressed: true }),
      ),
    );
    expect(html).toContain('aria-label="Edit levels"');
    expect(html).toContain('aria-pressed="true"');
    expect(buttonsWithoutName(html)).toEqual([]);
  });

  it("flags an icon-only button with no name", () => {
    expect(buttonsWithoutName('<button type="button"><svg></svg></button>')).toHaveLength(1);
    expect(buttonsWithoutName("<button>Save</button>")).toHaveLength(0);
  });

  it("is given a label everywhere it is used", () => {
    const root = join(process.cwd(), "src");
    const missing: string[] = [];
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<IconButton\b([\s\S]*?)\/?>/g)) {
        if (!/\blabel=/.test(match[1] ?? "")) missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });
});
