import type { HallTile } from "./schema";

/**
 * One score in the ribbon. Outline only, light weight, sharp corners: the xAI mark
 * (hairline border, no filled card) set in motion by a Magic UI-style marquee.
 */
function ScoreMark({ tile, quiet }: { tile: HallTile; quiet?: boolean }) {
  return (
    <li
      aria-hidden={quiet || undefined}
      className="score-mark flex items-baseline gap-3 border border-brand-600/20 px-5 py-3"
    >
      <span className="text-4xl font-light tabular-nums tracking-tight text-brand-700">
        {tile.score}
      </span>
      <span className="max-w-[10rem] truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {tile.name}
      </span>
    </li>
  );
}

/**
 * The score list as one continuous strip. Two identical halves so a -50% shift
 * loops without a seam. Hover pauses it and dims every mark except the one under
 * the pointer, the same reverse-hover xAI uses.
 */
export function ScoreRibbon({ tiles }: { tiles: HallTile[] }) {
  if (tiles.length === 0) return null;
  const row = Array.from({ length: 6 }, () => tiles).flat();
  return (
    <div className="score-marquee relative min-w-0 overflow-hidden">
      <ul className="score-marquee-track flex w-max items-center gap-3">
        {row.map((tile, i) => (
          <ScoreMark key={`a-${tile.name}-${i}`} tile={tile} quiet={i >= tiles.length} />
        ))}
        {row.map((tile, i) => (
          <ScoreMark key={`b-${tile.name}-${i}`} tile={tile} quiet />
        ))}
      </ul>
    </div>
  );
}
