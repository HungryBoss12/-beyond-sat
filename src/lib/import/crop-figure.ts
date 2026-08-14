export type FigureKind = "table" | "graph" | "diagram" | "number_line" | "figure";

export type FigureBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  caption?: string;
  /** Printed/import question number this box belongs to. */
  draft_number?: number;
  kind?: FigureKind;
  confidence?: number;
  /** Optional markdown transcription of a table (opt-in). */
  markdown?: string;
};

const FIGURE_KINDS = new Set<FigureKind>([
  "table",
  "graph",
  "diagram",
  "number_line",
  "figure",
]);

export function parseFigureKind(raw: unknown): FigureKind | undefined {
  if (typeof raw !== "string") return undefined;
  const k = raw.trim().toLowerCase().replace(/\s+/g, "_") as FigureKind;
  return FIGURE_KINDS.has(k) ? k : undefined;
}

export function clampBox(box: FigureBox): FigureBox {
  const x = Math.min(0.95, Math.max(0, Number.isFinite(box.x) ? box.x : 0));
  const y = Math.min(0.95, Math.max(0, Number.isFinite(box.y) ? box.y : 0));
  const w = Math.min(1 - x, Math.max(0.04, Number.isFinite(box.w) ? box.w : 0.04));
  const h = Math.min(1 - y, Math.max(0.04, Number.isFinite(box.h) ? box.h : 0.04));
  const caption = typeof box.caption === "string" ? box.caption.trim() : "";
  const draft_number =
    box.draft_number != null && Number.isFinite(box.draft_number)
      ? Math.round(box.draft_number)
      : undefined;
  const kind = box.kind;
  const confidence =
    box.confidence != null && Number.isFinite(box.confidence)
      ? Math.min(1, Math.max(0, box.confidence))
      : undefined;
  const markdown = typeof box.markdown === "string" ? box.markdown.trim() : "";
  const out: FigureBox = { x, y, w, h };
  if (caption) out.caption = caption;
  if (draft_number != null) out.draft_number = draft_number;
  if (kind) out.kind = kind;
  if (confidence != null) out.confidence = confidence;
  if (markdown) out.markdown = markdown;
  return out;
}

export function parseFigureBoxes(text: string): FigureBox[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { figures?: unknown };
    if (!Array.isArray(parsed.figures)) return [];
    return parsed.figures
      .filter(
        (f): f is Record<string, unknown> => !!f && typeof f === "object" && !Array.isArray(f),
      )
      .map((f) =>
        clampBox({
          x: Number(f.x),
          y: Number(f.y),
          w: Number(f.w),
          h: Number(f.h),
          caption: typeof f.caption === "string" ? f.caption : undefined,
          draft_number:
            f.draft_number != null && Number.isFinite(Number(f.draft_number))
              ? Number(f.draft_number)
              : undefined,
          kind: parseFigureKind(f.kind),
          confidence:
            f.confidence != null && Number.isFinite(Number(f.confidence))
              ? Number(f.confidence)
              : undefined,
          markdown: typeof f.markdown === "string" ? f.markdown : undefined,
        }),
      );
  } catch {
    return [];
  }
}

/** Drop boxes below this confidence when the model reports one. */
export const FIGURE_CONFIDENCE_FLOOR = 0.35;

export function filterConfidentBoxes(boxes: FigureBox[], floor = FIGURE_CONFIDENCE_FLOOR): FigureBox[] {
  return boxes.filter((b) => b.confidence == null || b.confidence >= floor);
}

/** One crop that covers every box in the list (same question only). */
export function unionBoxes(boxes: FigureBox[]): FigureBox | null {
  if (boxes.length === 0) return null;
  if (boxes.length === 1) return clampBox(boxes[0]);
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let caption = "";
  let draft_number: number | undefined;
  let kind: FigureKind | undefined;
  let confidence: number | undefined;
  let markdown = "";
  for (const raw of boxes) {
    const b = clampBox(raw);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
    if (!caption && b.caption) caption = b.caption;
    if (draft_number == null && b.draft_number != null) draft_number = b.draft_number;
    if (!kind && b.kind) kind = b.kind;
    if (b.confidence != null) {
      confidence = confidence == null ? b.confidence : Math.min(confidence, b.confidence);
    }
    if (!markdown && b.markdown) markdown = b.markdown;
  }
  return clampBox({
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    caption,
    draft_number,
    kind,
    confidence,
    markdown,
  });
}

/**
 * Boxes assigned to one draft. When multiple questions share a page, only boxes
 * with a matching draft_number are used — never unrelated figures.
 */
export function boxesForDraft(boxes: FigureBox[], draftNumber: number): FigureBox[] {
  const assigned = boxes.filter((b) => b.draft_number === draftNumber);
  if (assigned.length > 0) return assigned;
  const unassigned = boxes.filter((b) => b.draft_number == null);
  if (unassigned.length > 0 && boxes.every((b) => b.draft_number == null)) return unassigned;
  return [];
}

export function unionBoxesForDraft(boxes: FigureBox[], draftNumber: number): FigureBox | null {
  return unionBoxes(boxesForDraft(boxes, draftNumber));
}

/** Horizontal / vertical padding as fractions of the page, by figure kind. */
export function padForKind(kind?: FigureKind): { x: number; y: number } {
  switch (kind) {
    case "table":
      return { x: 0.035, y: 0.02 };
    case "graph":
      return { x: 0.025, y: 0.03 };
    case "number_line":
      return { x: 0.03, y: 0.025 };
    default:
      return { x: 0.02, y: 0.02 };
  }
}

export async function cropPageToBlob(
  dataUrl: string,
  box: FigureBox,
  pad?: number | { x: number; y: number },
): Promise<Blob> {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not load the page image to crop."));
  });
  img.src = dataUrl;
  await loaded;

  const pads =
    typeof pad === "number"
      ? { x: pad, y: pad }
      : pad ?? padForKind(box.kind);

  const padded = clampBox({
    x: box.x - pads.x,
    y: box.y - pads.y,
    w: box.w + pads.x * 2,
    h: box.h + pads.y * 2,
    caption: box.caption,
    kind: box.kind,
    draft_number: box.draft_number,
    confidence: box.confidence,
    markdown: box.markdown,
  });
  const sx = Math.round(padded.x * img.naturalWidth);
  const sy = Math.round(padded.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(padded.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(padded.h * img.naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("This browser wouldn't give a 2D canvas, so the figure can't be cropped.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the cropped figure."))),
      "image/png",
    );
  });
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}
