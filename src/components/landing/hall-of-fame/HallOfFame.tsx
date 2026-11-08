import type { ComponentType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { HallOfFameSlot } from "./HallOfFameSlot";
import { QuoteCard } from "./QuoteCard";
import { ScoreReportCard } from "./ScoreReportCard";
import { ScoreRibbon } from "./ScoreTile";
import { TopScoreCard } from "./TopScoreCard";
import { parseHallOfFame, type HallOfFameModel } from "./schema";

export type CtaLinkComponent = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
}>;

type Pt = readonly [number, number];

/** The piece of a cubic between two parameters, as one `C` command. */
function stemPath(p0: Pt, p1: Pt, p2: Pt, p3: Pt, from: number, to: number) {
  const cut = (a: Pt, b: Pt, c: Pt, d: Pt, t: number) => {
    const m = (p: Pt, q: Pt): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const ab = m(a, b);
    const bc = m(b, c);
    const cd = m(c, d);
    const abbc = m(ab, bc);
    const bccd = m(bc, cd);
    const mid = m(abbc, bccd);
    return { left: [a, ab, abbc, mid] as const, right: [mid, bccd, cd, d] as const };
  };
  const after = cut(p0, p1, p2, p3, from).right;
  const span = (to - from) / (1 - from);
  const [a, b, c, d] = cut(after[0], after[1], after[2], after[3], span).left;
  const n = (v: number) => Math.round(v * 10) / 10;
  return `M${n(a[0])} ${n(a[1])}C${n(b[0])} ${n(b[1])} ${n(c[0])} ${n(c[1])} ${n(d[0])} ${n(d[1])}`;
}

/**
 * One bay branch. The stem is a single bow that opens toward the title; the
 * other side is this mark mirrored. Leaves are sampled off that bow so they
 * follow it instead of sitting in two straight rows.
 */
function Laurel({ className }: { className?: string }) {
  // Base of the leaf is the origin; the tip points along +x.
  const leaf = "M0 0C3.2-2.2 14-6.6 26-1.1 28.4 0 26 1.1 14 6.6 3.2 2.2 0 0 0 0Z";
  // Top tip near the title, belly away from it, bottom tip back toward the title.
  const p0: Pt = [78, 10];
  const p1: Pt = [28, 36];
  const p2: Pt = [16, 84];
  const p3: Pt = [78, 110];

  function at(t: number) {
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const along = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Screen y grows downward, so (-dy, dx) is the side away from the title.
    const away = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return { x, y, along, away };
  }

  function turn(from: number, toward: number, amount: number) {
    const delta = (((toward - from + 540) % 360) - 180) * amount;
    return Math.round((from + delta) * 10) / 10;
  }

  // Outer leaves lean off the title side of the bow. Inner ones sit toward
  // the title, staggered, so the two rows follow the same curve. The stem
  // stops at the first and last leaf.
  const outer = [0.08, 0.24, 0.4, 0.56, 0.72, 0.9].map((t) => {
    const p = at(t);
    return { ...p, rot: turn(p.along, p.away, 0.42), scale: 1 };
  });
  const inner = [0.16, 0.32, 0.48, 0.64, 0.8].map((t) => {
    const p = at(t);
    return { ...p, rot: turn(p.along, p.away + 180, 0.36), scale: 0.66 };
  });
  const stem = stemPath(p0, p1, p2, p3, 0.06, 0.94);

  return (
    <svg viewBox="-4 0 108 120" className={className} aria-hidden="true" fill="currentColor">
      <path d={stem} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {outer.map((p) => (
        <path
          key={`o${p.y}`}
          d={leaf}
          transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot})`}
        />
      ))}
      {inner.map((p) => (
        <path
          key={`i${p.y}`}
          d={leaf}
          opacity="0.45"
          transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot}) scale(${p.scale})`}
        />
      ))}
    </svg>
  );
}

function renderHeading(m: HallOfFameModel) {
  return (
    <div className="parallax-rise mb-12 text-center">
      <h2 className="flex items-center justify-center gap-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:gap-4 sm:text-4xl md:gap-6 md:text-5xl">
        <Laurel className="h-12 w-9 shrink-0 text-brand-600 sm:h-16 sm:w-12 md:h-24 md:w-[4.5rem]" />
        <span>Hall of Fame</span>
        <Laurel className="h-12 w-9 shrink-0 -scale-x-100 text-brand-600 sm:h-16 sm:w-12 md:h-24 md:w-[4.5rem]" />
      </h2>
      {m.subtitle && <p className="mt-4 text-lg leading-relaxed text-slate-500">{m.subtitle}</p>}
    </div>
  );
}

function renderScores(m: HallOfFameModel, Cta: CtaLinkComponent) {
  if (!m.top && m.tiles.length === 0) return null;
  return (
    <div className="min-w-0 space-y-4">
      {m.top && <TopScoreCard top={m.top} />}
      {m.tiles.length > 0 && <ScoreRibbon tiles={m.tiles} />}
      {m.ctaLabel && (
        <Cta
          href={m.ctaHref}
          className="tap inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          {m.ctaLabel} <ArrowRight className="h-4 w-4" />
        </Cta>
      )}
    </div>
  );
}

function renderProof(m: HallOfFameModel) {
  if (!m.quote && !m.report) return null;
  return (
    <div className="space-y-4">
      {m.quote && <QuoteCard quote={m.quote} />}
      {m.report && <ScoreReportCard report={m.report} />}
    </div>
  );
}

/**
 * The landing "reviews" section, redesigned as a hall of fame. The look is fixed here; the admin only
 * supplies data, which `parseHallOfFame` clamps and defaults so a bad value cannot break the layout.
 */
export function HallOfFame({
  data,
  Cta,
}: {
  data: Record<string, unknown>;
  Cta: CtaLinkComponent;
}) {
  const model = parseHallOfFame(data);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {renderHeading(model)}
      {/* With no quote or report the scores sit alone, so they stay centred rather than leave a hole. */}
      <div
        className={
          model.quote || model.report ? "grid gap-6 lg:grid-cols-2" : "mx-auto grid max-w-3xl gap-6"
        }
      >
        {renderScores(model, Cta)}
        {renderProof(model)}
      </div>
      {model.stories.length > 0 && (
        <div className="mt-10 md:mt-14">
          <HallOfFameSlot stories={model.stories} />
        </div>
      )}
    </div>
  );
}
