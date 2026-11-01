import { PersonAvatar } from "./PersonAvatar";
import type { HallTile } from "./schema";

/** One score in the grid: the number leads, the name sits under it. */
export function ScoreTile({ tile }: { tile: HallTile }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-brand-400/30 bg-brand-50 px-3.5 py-3">
      <PersonAvatar name={tile.name} photo={tile.photo} className="h-8 w-8 shrink-0" />
      <div className="min-w-0">
        <div className="text-xl font-black leading-none text-brand-700">{tile.score}</div>
        <div className="mt-1 truncate text-xs font-semibold text-slate-600">{tile.name}</div>
      </div>
    </li>
  );
}
