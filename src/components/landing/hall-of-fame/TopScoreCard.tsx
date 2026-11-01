import { Trophy } from "lucide-react";
import { RevealCard } from "@/components/ui/reveal-card";
import { PersonAvatar } from "./PersonAvatar";
import type { HallTop } from "./schema";

/** The single highest score, shown large above the grid. */
export function TopScoreCard({ top }: { top: HallTop }) {
  return (
    <RevealCard className="lift relative overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 p-6 text-white shadow-panel md:p-8">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-100">
        <Trophy className="h-4 w-4" strokeWidth={2.25} />
        Top score
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-6xl font-black leading-none tracking-tight md:text-7xl">
            {top.score}
          </div>
          <div className="mt-3 truncate text-lg font-bold">{top.name}</div>
          {top.caption && <div className="mt-1 text-sm text-brand-100">{top.caption}</div>}
        </div>
        <PersonAvatar
          name={top.name}
          photo={top.photo}
          className="h-16 w-16 shrink-0 ring-2 ring-white/40 md:h-20 md:w-20"
          fallbackClassName="text-lg"
        />
      </div>
    </RevealCard>
  );
}
