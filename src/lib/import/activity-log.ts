import type { Draft } from "./parse";

export type ActivityActor =
  | "gemini-fix"
  | "nemotron-recheck"
  | "gemini-locate"
  | "crop"
  | "admin";

export type ActivityFieldDiff = {
  key: string;
  before: string;
  after: string;
};

export type ActivityEntry = {
  id: string;
  at: number;
  actor: ActivityActor;
  model?: string;
  draftIndex: number;
  draftNumber: number;
  summary: string;
  fields: ActivityFieldDiff[];
  /** Draft state before this change — used by Undo. */
  snapshot?: Draft;
};

export const ACTOR_LABEL: Record<ActivityActor, string> = {
  "gemini-fix": "Gemini Fix",
  "nemotron-recheck": "Nemotron Recheck",
  "gemini-locate": "Gemini Locate",
  crop: "Crop",
  admin: "You",
};

export const ACTOR_MODEL: Partial<Record<ActivityActor, string>> = {
  "gemini-fix": "gemini-3-flash-preview",
  "nemotron-recheck": "nemotron-3-ultra",
  "gemini-locate": "gemini-3-flash-preview",
};

let seq = 0;

export function makeActivityId(): string {
  seq += 1;
  return `act-${Date.now()}-${seq}`;
}

export function cloneDraft(draft: Draft): Draft {
  return {
    ...draft,
    rec: { ...draft.rec },
    warnings: [...draft.warnings],
    sourceImages: draft.sourceImages ? [...draft.sourceImages] : undefined,
  };
}

/** Diff two flat draft records; empty/whitespace-only values normalize to "". */
export function diffRec(
  before: Record<string, string>,
  after: Record<string, string>,
): ActivityFieldDiff[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: ActivityFieldDiff[] = [];
  for (const key of [...keys].sort()) {
    const a = (before[key] ?? "").trim();
    const b = (after[key] ?? "").trim();
    if (a === b) continue;
    out.push({ key, before: a, after: b });
  }
  return out;
}

export function makeActivityEntry(opts: {
  actor: ActivityActor;
  draftIndex: number;
  draftNumber: number;
  summary: string;
  fields?: ActivityFieldDiff[];
  snapshot?: Draft;
  model?: string;
}): ActivityEntry {
  return {
    id: makeActivityId(),
    at: Date.now(),
    actor: opts.actor,
    model: opts.model ?? ACTOR_MODEL[opts.actor],
    draftIndex: opts.draftIndex,
    draftNumber: opts.draftNumber,
    summary: opts.summary,
    fields: opts.fields ?? [],
    snapshot: opts.snapshot,
  };
}
