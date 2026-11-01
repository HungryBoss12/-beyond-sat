import { z } from "zod";
import { safeMediaUrl } from "@/lib/safe-url";

/**
 * The Hall of Fame reads the `reviews` homepage section. That row is admin-authored JSON, so it is
 * parsed here at the boundary instead of cast: every field is clamped or defaulted, and a bad value
 * drops one tile rather than the whole section.
 *
 * Rows saved before the redesign only carry `items` (stars, quote, name, detail, avatar). Those keep
 * rendering: each item becomes a story, and a score at the start of `detail` ("1520 · +180 points")
 * becomes a tile.
 */

export const MIN_SCORE = 400;
export const MAX_SCORE = 1600;
const MAX_TILES = 24;
const MAX_STORIES = 24;

function text(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : ""),
    z.string(),
  );
}

function score() {
  return z.preprocess((v) => {
    if (v === null || v === "" || typeof v === "boolean") return undefined;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= MIN_SCORE && n <= MAX_SCORE ? n : undefined;
  }, z.number().optional());
}

function section() {
  return z.preprocess(
    (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}),
    z.object({}).passthrough(),
  );
}

function photo() {
  return z.preprocess((v) => (typeof v === "string" ? (safeMediaUrl(v) ?? "") : ""), z.string());
}

const tileSchema = z.object({ name: text(60), score: score(), photo: photo() });
const topSchema = z.object({ name: text(60), score: score(), caption: text(80), photo: photo() });
const quoteSchema = z.object({ text: text(400), name: text(60), detail: text(80) });
const reportSchema = z.object({
  name: text(60),
  date: text(40),
  locator: text(40),
  reading_writing: score(),
  math: score(),
});
const storySchema = z.object({
  name: text(60),
  detail: text(80),
  quote: text(600),
  country: text(40),
  score: score(),
  avatar: photo(),
});

export type HallTile = { name: string; score: number; photo: string };
export type HallTop = { name: string; score: number; caption: string; photo: string };
export type HallQuote = { text: string; name: string; detail: string };
export type HallReport = {
  name: string;
  date: string;
  locator: string;
  readingWriting: number;
  math: number;
};
export type HallStory = {
  name: string;
  detail: string;
  quote: string;
  country: string;
  score?: number;
  photo: string;
};
export type HallOfFameModel = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  top: HallTop | null;
  tiles: HallTile[];
  quote: HallQuote | null;
  report: HallReport | null;
  stories: HallStory[];
};

function parseList<T extends z.ZodTypeAny>(schema: T, raw: unknown, max: number): z.output<T>[] {
  if (!Array.isArray(raw)) return [];
  const out: z.output<T>[] = [];
  for (const entry of raw.slice(0, max)) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** A score written first in a free-text line, e.g. "1520 · +180 points". */
export function leadingScore(detail: string): number | undefined {
  const match = /^\s*(\d{3,4})\b/.exec(detail);
  if (!match) return undefined;
  const n = Number(match[1]);
  return n >= MIN_SCORE && n <= MAX_SCORE ? n : undefined;
}

function buildTiles(rawTiles: unknown, stories: HallStory[]): HallTile[] {
  const explicit = parseList(tileSchema, rawTiles, MAX_TILES).flatMap((t) =>
    t.name && t.score !== undefined ? [{ name: t.name, score: t.score, photo: t.photo }] : [],
  );
  if (explicit.length > 0) return explicit;
  return stories.flatMap((s) =>
    s.name && s.score !== undefined ? [{ name: s.name, score: s.score, photo: s.photo }] : [],
  );
}

function buildTop(rawTop: unknown, tiles: HallTile[]): HallTop | null {
  const parsed = topSchema.safeParse(section().parse(rawTop));
  if (parsed.success && parsed.data.name && parsed.data.score !== undefined) {
    return { ...parsed.data, score: parsed.data.score };
  }
  const best = tiles.reduce<HallTile | null>(
    (a, t) => (a === null || t.score > a.score ? t : a),
    null,
  );
  return best ? { name: best.name, score: best.score, caption: "", photo: best.photo } : null;
}

function buildQuote(rawQuote: unknown): HallQuote | null {
  const parsed = quoteSchema.parse(section().parse(rawQuote));
  return parsed.text ? parsed : null;
}

function buildReport(rawReport: unknown): HallReport | null {
  const r = reportSchema.parse(section().parse(rawReport));
  if (r.reading_writing === undefined || r.math === undefined) return null;
  return {
    name: r.name,
    date: r.date,
    locator: r.locator,
    readingWriting: r.reading_writing,
    math: r.math,
  };
}

function buildStories(rawItems: unknown): HallStory[] {
  return parseList(storySchema, rawItems, MAX_STORIES).flatMap((s) => {
    if (!s.name && !s.quote) return [];
    return [
      {
        name: s.name,
        detail: s.detail,
        quote: s.quote,
        country: s.country,
        score: s.score ?? leadingScore(s.detail),
        photo: s.avatar,
      },
    ];
  });
}

export function parseHallOfFame(data: Record<string, unknown>): HallOfFameModel {
  const stories = buildStories(data.items);
  const tiles = buildTiles(data.tiles, stories);
  const cta = z
    .object({ label: text(40), href: text(200) })
    .parse({ label: data.cta_label, href: data.cta_href });
  return {
    title: text(120).parse(data.title),
    subtitle: text(240).parse(data.subtitle),
    ctaLabel: cta.label,
    ctaHref: cta.href || "/signup",
    top: buildTop(data.top, tiles),
    tiles,
    quote: buildQuote(data.quote),
    report: buildReport(data.report),
    stories,
  };
}

/** Two-letter fallback for a photo that is missing or fails to load. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
