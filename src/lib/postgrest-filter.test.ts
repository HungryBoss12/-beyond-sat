import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { quoteFilterValue } from "./postgrest-filter";

const LIB_ROOT = fileURLToPath(new URL(".", import.meta.url));

/** `eq.${...}`, `ilike.%${...}`, `gte.${...}`, `in.(${...})` */
const FILTER_VALUE = /(?:\b(?:eq|ilike|like|gte|gt|lte|lt|neq|not)\.(?:%+)?|in\.\()\$\{/g;

function templateExpr(line: string, afterBrace: number): string {
  let depth = 1;
  let i = afterBrace;
  while (i < line.length && depth > 0) {
    if (line[i] === "{") depth += 1;
    else if (line[i] === "}") depth -= 1;
    if (depth > 0) i += 1;
  }
  return line.slice(afterBrace, i);
}

export function unencodedFilterLines(source: string): string[] {
  const hits: string[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    FILTER_VALUE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FILTER_VALUE.exec(line))) {
      const expr = templateExpr(line, match.index + match[0].length);
      if (!expr.includes("encodeURIComponent") && !expr.includes("quoteFilterValue")) {
        hits.push(`${i + 1}: ${line.trim()}`);
      }
    }
  }
  return hits;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

describe("quoteFilterValue", () => {
  it("wraps a value so PostgREST treats dots and commas as text", () => {
    expect(quoteFilterValue("a.b,c")).toBe('"a.b,c"');
    expect(quoteFilterValue('say "hi"\\')).toBe('"say hi"');
  });
});

describe("PostgREST filter strings", () => {
  it("rejects a query string that pastes a variable in raw", () => {
    const sample = 'fetch(`cards?title=eq.${name}&id=in.(${ids.join(",")})`)';
    expect(unencodedFilterLines(sample)).toHaveLength(2);
  });

  it("accepts encodeURIComponent and quoteFilterValue", () => {
    const sample = [
      "`cards?title=eq.${encodeURIComponent(name)}`",
      "`.or(`name.ilike.${quoteFilterValue(needle)}`)`",
      "`log?id=in.(${rows.map((row) => encodeURIComponent(row.id)).join(\",\")})`",
    ].join("\n");
    expect(unencodedFilterLines(sample)).toEqual([]);
  });

  it("encodes every interpolated filter in src/lib", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(LIB_ROOT)) {
      const found = unencodedFilterLines(readFileSync(file, "utf8"));
      for (const line of found) hits.push(`${file}: ${line}`);
    }
    expect(hits).toEqual([]);
  });
});
