import { supabase } from "@/integrations/supabase/client";
import type { Draft } from "./parse";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to fix questions.");
  return { Authorization: `Bearer ${token}` };
}

export type FixClientStage = "extract" | "recheck";

export async function fixDraftWithGemini(
  input: {
    number: number;
    rec: Record<string, string>;
    errors: string[];
    warnings: string[];
  },
  opts: {
    signal?: AbortSignal;
    stage?: FixClientStage;
    priorFix?: string;
  } = {},
): Promise<string> {
  const response = await fetch("/api/import/fix", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    signal: opts.signal,
    body: JSON.stringify({
      number: input.number,
      rec: input.rec,
      errors: input.errors,
      warnings: input.warnings,
      stage: opts.stage ?? "extract",
      priorFix: opts.priorFix,
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    content?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Question fix is unavailable.");
  }

  return data?.content ?? "";
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "object") return "";
  return String(value);
}

/** Merge a Gemini fix object into an existing draft record. */
export function applyFixToDraft(draft: Draft, fixed: Record<string, unknown>): Draft {
  const rec: Record<string, string> = { ...draft.rec };

  const mapKeys = [
    "section",
    "skill",
    "difficulty",
    "kind",
    "question_text",
    "prompt",
    "correct",
    "explanation",
    "source_month",
    "source_year",
  ] as const;

  for (const key of mapKeys) {
    if (key in fixed) {
      const v = asText(fixed[key]).trim();
      if (v) rec[key] = v;
    }
  }

  // Nested choices array → choice_A…
  if (Array.isArray(fixed.choices)) {
    fixed.choices.forEach((c, i) => {
      if (i >= 8) return;
      const letter = String.fromCharCode(65 + i);
      const text = asText(c).trim();
      if (text) rec[`choice_${letter}`] = text;
    });
  }

  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    const key = `choice_${letter}`;
    if (key in fixed) {
      const v = asText(fixed[key]).trim();
      if (v) rec[key] = v;
    }
  }

  const warnings = draft.warnings.filter(
    (w) => !w.includes("No printed number") && !w.includes("isn't in this section"),
  );
  warnings.push("Repaired by Gemini (extract + recheck).");

  return { ...draft, rec, warnings };
}

export type FixBrokenProgress = {
  /** 1-based index among broken rows currently being fixed. */
  index: number;
  total: number;
  draftNumber: number;
  stage: 1 | 2;
  stageLabel: "Fix" | "Recheck";
  stage1Done: number;
  stage2Done: number;
  fixed: number;
  failed: number;
};

export type FixBrokenTarget = {
  draftIndex: number;
  draft: Draft;
  errors: string[];
  warnings: string[];
};

/**
 * Run two-stage Gemini repair over broken drafts. Mutates via returned array
 * (same length as `allDrafts`, with fixed indices replaced).
 */
export async function fixBrokenDrafts(
  allDrafts: Draft[],
  targets: FixBrokenTarget[],
  opts: {
    signal?: AbortSignal;
    shouldStop?: () => boolean;
    onProgress?: (p: FixBrokenProgress) => void;
  } = {},
): Promise<{ drafts: Draft[]; notes: string[]; fixed: number; failed: number }> {
  const next = allDrafts.map((d) => ({ ...d, rec: { ...d.rec }, warnings: [...d.warnings] }));
  const notes: string[] = [];
  let fixed = 0;
  let failed = 0;
  let stage1Done = 0;
  let stage2Done = 0;

  for (let i = 0; i < targets.length; i++) {
    if (opts.shouldStop?.()) break;
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const t = targets[i];
    const report = (stage: 1 | 2) => {
      opts.onProgress?.({
        index: i + 1,
        total: targets.length,
        draftNumber: t.draft.number,
        stage,
        stageLabel: stage === 1 ? "Fix" : "Recheck",
        stage1Done,
        stage2Done,
        fixed,
        failed,
      });
    };

    const input = {
      number: t.draft.number,
      rec: next[t.draftIndex].rec,
      errors: t.errors,
      warnings: t.warnings,
    };

    let first: string;
    try {
      report(1);
      first = await fixDraftWithGemini(input, { signal: opts.signal, stage: "extract" });
      stage1Done++;
      report(1);
    } catch (err) {
      failed++;
      notes.push(`Q${t.draft.number} (fix): ${(err as Error)?.message ?? "fix failed"}.`);
      report(1);
      continue;
    }

    let content = first;
    try {
      report(2);
      content = await fixDraftWithGemini(input, {
        signal: opts.signal,
        stage: "recheck",
        priorFix: first,
      });
      stage2Done++;
    } catch (err) {
      notes.push(
        `Q${t.draft.number} (recheck): ${(err as Error)?.message ?? "recheck failed"} — using fix result.`,
      );
      stage2Done++;
    }

    const obj = extractJsonObject(content) ?? extractJsonObject(first);
    if (!obj) {
      failed++;
      notes.push(`Q${t.draft.number}: Gemini did not return usable JSON.`);
      report(2);
      continue;
    }

    next[t.draftIndex] = applyFixToDraft(next[t.draftIndex], obj);
    fixed++;
    report(2);
  }

  notes.unshift(
    `Fix pass: repaired ${fixed} of ${targets.length} broken row${targets.length === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}.`,
  );

  return { drafts: next, notes, fixed, failed };
}
