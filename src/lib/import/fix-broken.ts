import { supabase } from "@/integrations/supabase/client";
import type { Draft } from "./parse";
import { cloneDraft, diffRec, makeActivityEntry, type ActivityEntry } from "./activity-log";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to fix questions.");
  return { Authorization: `Bearer ${token}` };
}

export type FixClientStage = "extract" | "recheck" | "ask";

export class FixClientError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "FixClientError";
    this.code = code;
  }
}

export function isRateLimitFixError(err: unknown): boolean {
  if (err instanceof FixClientError && err.code === "RATE_LIMIT") return true;
  const msg = ((err as Error)?.message ?? "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("free limit") ||
    msg.includes("busy") ||
    msg.includes("too many requests")
  );
}

export type FixDraftResult = {
  content: string;
  /** True when the server used OpenRouter because Gemini Flash was limited. */
  fallback?: boolean;
};

export async function fixDraftWithGemini(
  input: {
    number: number;
    rec: Record<string, string>;
    errors: string[];
    warnings: string[];
    instruction?: string;
  },
  opts: {
    signal?: AbortSignal;
    stage?: FixClientStage;
    priorFix?: string;
  } = {},
): Promise<FixDraftResult> {
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
      instruction: input.instruction,
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    content?: string;
    error?: string;
    code?: string;
    fallback?: boolean;
  } | null;

  if (!response.ok) {
    throw new FixClientError(
      data?.error ?? "Question fix is unavailable.",
      data?.code ?? (response.status === 429 ? "RATE_LIMIT" : undefined),
    );
  }

  return {
    content: data?.content ?? "",
    fallback: data?.fallback === true,
  };
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
  if (!(rec.correct ?? "").trim()) {
    const alias = asText(fixed.answer).trim();
    if (alias) rec.correct = alias;
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
  if (!warnings.some((w) => w.includes("Repaired by Gemini"))) {
    warnings.push("Repaired by Gemini (extract + recheck).");
  }

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
  /** Shown while waiting / after Flash limit (e.g. backup model). */
  statusNote?: string;
};

export type FixBrokenTarget = {
  draftIndex: number;
  draft: Draft;
  errors: string[];
  warnings: string[];
};

function isAbortError(err: unknown): boolean {
  return (err as Error)?.name === "AbortError";
}

function summarizeFields(fields: { key: string }[]): string {
  if (fields.length === 0) return "no field changes";
  const keys = fields.map((f) => f.key).slice(0, 6);
  return keys.join(", ") + (fields.length > 6 ? ` (+${fields.length - 6})` : "");
}

/** Stop the batch after this many consecutive Flash/backup rate limits. */
const CONSECUTIVE_RATE_LIMIT_STOP = 2;

/**
 * Run two-stage Gemini repair over broken drafts. Mutates via returned array
 * (same length as `allDrafts`, with fixed indices replaced).
 *
 * Stop/abort returns whatever rows were already repaired instead of throwing,
 * so the editor can keep that work.
 */
export async function fixBrokenDrafts(
  allDrafts: Draft[],
  targets: FixBrokenTarget[],
  opts: {
    signal?: AbortSignal;
    shouldStop?: () => boolean;
    onProgress?: (p: FixBrokenProgress) => void;
  } = {},
): Promise<{
  drafts: Draft[];
  notes: string[];
  entries: ActivityEntry[];
  fixed: number;
  failed: number;
}> {
  const next = allDrafts.map((d) => ({ ...d, rec: { ...d.rec }, warnings: [...d.warnings] }));
  const notes: string[] = [];
  const entries: ActivityEntry[] = [];
  let fixed = 0;
  let failed = 0;
  let stage1Done = 0;
  let stage2Done = 0;
  let stopped = false;
  let stoppedForRateLimit = false;
  let consecutiveRateLimits = 0;
  let usedFallbackCount = 0;

  const halted = () => Boolean(opts.shouldStop?.() || opts.signal?.aborted);

  for (let i = 0; i < targets.length; i++) {
    if (halted()) {
      stopped = true;
      break;
    }

    const t = targets[i];
    const report = (stage: 1 | 2, statusNote?: string) => {
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
        statusNote,
      });
    };

    const input = {
      number: t.draft.number,
      rec: next[t.draftIndex].rec,
      errors: t.errors,
      warnings: t.warnings,
    };

    const originalSnapshot = cloneDraft(next[t.draftIndex]);

    let firstResult: FixDraftResult;
    try {
      report(1);
      firstResult = await fixDraftWithGemini(input, { signal: opts.signal, stage: "extract" });
      consecutiveRateLimits = 0;
      stage1Done++;
      if (firstResult.fallback) {
        usedFallbackCount++;
        notes.push(
          `Q${t.draft.number}: Gemini Flash was limited — fixed with the backup model (Nemotron).`,
        );
        report(1, "Flash limited — using backup model");
      } else {
        report(1);
      }
    } catch (err) {
      if (isAbortError(err) || halted()) {
        stopped = true;
        break;
      }
      failed++;
      notes.push(`Q${t.draft.number} (fix): ${(err as Error)?.message ?? "fix failed"}.`);
      if (isRateLimitFixError(err)) {
        consecutiveRateLimits++;
        if (consecutiveRateLimits >= CONSECUTIVE_RATE_LIMIT_STOP) {
          stopped = true;
          stoppedForRateLimit = true;
          notes.push(
            `Stopped after Gemini Flash hit its free limit twice in a row. ${fixed} row${fixed === 1 ? "" : "s"} already repaired ${fixed === 1 ? "is" : "are"} kept — wait a minute, then run Fix again on the rest.`,
          );
          report(1, "Flash free limit — paused");
          break;
        }
      } else {
        consecutiveRateLimits = 0;
      }
      report(1);
      continue;
    }

    const first = firstResult.content;
    const firstObj = extractJsonObject(first);
    if (!firstObj) {
      failed++;
      notes.push(`Q${t.draft.number}: Gemini did not return usable JSON.`);
      report(2);
      continue;
    }

    const afterGemini = applyFixToDraft(next[t.draftIndex], firstObj);
    const geminiFields = diffRec(originalSnapshot.rec, afterGemini.rec);
    entries.push(
      makeActivityEntry({
        actor: firstResult.fallback ? "nemotron-recheck" : "gemini-fix",
        draftIndex: t.draftIndex,
        draftNumber: t.draft.number,
        summary: firstResult.fallback
          ? `Fixed Q${t.draft.number} via backup model (Flash limited): ${summarizeFields(geminiFields)}.`
          : `Fixed Q${t.draft.number}: ${summarizeFields(geminiFields)}.`,
        fields: geminiFields,
        snapshot: originalSnapshot,
      }),
    );
    next[t.draftIndex] = afterGemini;

    let content = first;
    let usedRecheck = false;
    try {
      report(2);
      const recheck = await fixDraftWithGemini(input, {
        signal: opts.signal,
        stage: "recheck",
        priorFix: first,
      });
      content = recheck.content;
      stage2Done++;
      usedRecheck = true;
    } catch (err) {
      if (isAbortError(err) || halted()) {
        notes.push(`Q${t.draft.number} (recheck): stopped — using fix result.`);
        stopped = true;
      } else {
        notes.push(
          `Q${t.draft.number} (recheck): ${(err as Error)?.message ?? "recheck failed"} — using fix result.`,
        );
      }
    }

    if (usedRecheck) {
      const secondObj = extractJsonObject(content);
      if (secondObj) {
        const beforeRecheck = cloneDraft(next[t.draftIndex]);
        const afterNemotron = applyFixToDraft(next[t.draftIndex], secondObj);
        const nemoFields = diffRec(beforeRecheck.rec, afterNemotron.rec);
        entries.push(
          makeActivityEntry({
            actor: "nemotron-recheck",
            draftIndex: t.draftIndex,
            draftNumber: t.draft.number,
            summary:
              nemoFields.length > 0
                ? `Rechecked Q${t.draft.number}: ${summarizeFields(nemoFields)}.`
                : `Rechecked Q${t.draft.number}: no further changes.`,
            fields: nemoFields,
            snapshot: beforeRecheck,
          }),
        );
        next[t.draftIndex] = afterNemotron;
      }
    }

    fixed++;
    report(2);
    if (stopped) break;
  }

  if (stopped && !stoppedForRateLimit) {
    notes.unshift("Stopped — rows already repaired are kept.");
  }
  if (usedFallbackCount > 0) {
    notes.unshift(
      `Backup model used for ${usedFallbackCount} question${usedFallbackCount === 1 ? "" : "s"} because Gemini Flash hit its free limit.`,
    );
  }
  notes.unshift(
    `Fix pass: repaired ${fixed} of ${targets.length} broken row${targets.length === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}.`,
  );

  return { drafts: next, notes, entries, fixed, failed };
}

/** Apply a free-text instruction to one draft via Gemini. */
export async function askDraftWithGemini(
  allDrafts: Draft[],
  draftIndex: number,
  instruction: string,
  opts: { signal?: AbortSignal } = {},
): Promise<{ drafts: Draft[]; entries: ActivityEntry[] }> {
  const draft = allDrafts[draftIndex];
  if (!draft) throw new Error("Question not found.");
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error("Type an instruction first.");

  const next = allDrafts.map((d) => ({ ...d, rec: { ...d.rec }, warnings: [...d.warnings] }));
  const snapshot = cloneDraft(draft);

  const adminEntry = makeActivityEntry({
    actor: "admin",
    draftIndex,
    draftNumber: draft.number,
    summary: `Asked on Q${draft.number}: ${trimmed.slice(0, 160)}${trimmed.length > 160 ? "…" : ""}`,
  });

  const result = await fixDraftWithGemini(
    {
      number: draft.number,
      rec: draft.rec,
      errors: [],
      warnings: draft.warnings,
      instruction: trimmed,
    },
    { signal: opts.signal, stage: "ask" },
  );

  const obj = extractJsonObject(result.content);
  if (!obj) throw new Error("Gemini did not return usable JSON for that instruction.");

  next[draftIndex] = applyFixToDraft(next[draftIndex], obj);
  const fields = diffRec(snapshot.rec, next[draftIndex].rec);
  const resultEntry = makeActivityEntry({
    actor: result.fallback ? "nemotron-recheck" : "gemini-fix",
    draftIndex,
    draftNumber: draft.number,
    summary: result.fallback
      ? `Applied instruction on Q${draft.number} via backup model (Flash limited): ${summarizeFields(fields)}.`
      : `Applied instruction on Q${draft.number}: ${summarizeFields(fields)}.`,
    fields,
    snapshot,
  });

  return { drafts: next, entries: [adminEntry, resultEntry] };
}
