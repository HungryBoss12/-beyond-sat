import type { ComponentType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { HallOfFameSlot } from "./HallOfFameSlot";
import { QuoteCard } from "./QuoteCard";
import { ScoreReportCard } from "./ScoreReportCard";
import { ScoreTile } from "./ScoreTile";
import { TopScoreCard } from "./TopScoreCard";
import { parseHallOfFame, type HallOfFameModel } from "./schema";

export type CtaLinkComponent = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
}>;

function renderHeading(m: HallOfFameModel) {
  if (!m.title && !m.subtitle) return null;
  return (
    <div className="parallax-rise mb-12 text-center">
      {m.title && <h2 className="text-3xl text-slate-900 md:text-4xl">{m.title}</h2>}
      {m.subtitle && <p className="mt-3 text-slate-500">{m.subtitle}</p>}
    </div>
  );
}

function renderScores(m: HallOfFameModel, Cta: CtaLinkComponent) {
  if (!m.top && m.tiles.length === 0) return null;
  return (
    <div className="space-y-4">
      {m.top && <TopScoreCard top={m.top} />}
      {m.tiles.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {m.tiles.map((t, i) => (
            <ScoreTile key={`${t.name}-${i}`} tile={t} />
          ))}
        </ul>
      )}
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
