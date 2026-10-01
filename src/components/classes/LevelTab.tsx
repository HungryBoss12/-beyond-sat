import { Columns3, Gauge, History, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LevelBoardRow, LevelSection } from "@/lib/classes/groups";
import { levelTrend, sectionShort } from "@/lib/classes/level";
import type { GridPerson } from "./LessonGrids";

export function SectionToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <IconButton
      icon={Columns3}
      label={expanded ? "Hide section scores" : "Show section scores"}
      pressed={expanded}
      className="text-white hover:bg-brand-500"
      onClick={onToggle}
    />
  );
}

export function LevelValue({ row }: { row: LevelBoardRow | undefined }) {
  if (!row || row.overall == null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="text-brand-100">
            —
          </span>
        </TooltipTrigger>
        <TooltipContent className="bg-brand-800 text-white">No sections scored</TooltipContent>
      </Tooltip>
    );
  }
  const trend = levelTrend(row.overall, row.previous_overall);
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : trend ? Minus : null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      <span className="font-black">{row.overall}</span>
      <span className="text-xs text-brand-100">
        · {row.scored}/{row.sections}
      </span>
      {TrendIcon && (
        <TrendIcon
          className="h-3.5 w-3.5"
          aria-label={
            trend === "up"
              ? "Up since last assessment"
              : trend === "down"
                ? "Down since last assessment"
                : "No change"
          }
        />
      )}
    </span>
  );
}

export function LevelTab({
  people,
  sections,
  board,
  expanded,
  onToggle,
  onEdit,
  onHistory,
}: {
  people: GridPerson[];
  sections: LevelSection[];
  board: Map<string, LevelBoardRow>;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (userId: string) => void;
  onHistory: (userId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-brand-100">
          Level is a 400–1000 diagnostic per section. Overall = mean of the scored sections.
        </p>
        <SectionToggle expanded={expanded} onToggle={onToggle} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-max text-left text-sm">
          <thead className="text-[11px] font-bold text-brand-100">
            <tr>
              <th className="sticky left-0 z-10 bg-brand-600 px-2 py-2">Student</th>
              <th className="px-2 py-2">L</th>
              {expanded &&
                sections.map((section) => (
                  <th key={section.id} className="px-2 py-2 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <abbr
                          title={section.name}
                          className="cursor-help no-underline"
                          tabIndex={0}
                        >
                          {sectionShort(section.name)}
                        </abbr>
                      </TooltipTrigger>
                      <TooltipContent className="bg-brand-800 text-white">
                        {section.name}
                      </TooltipContent>
                    </Tooltip>
                  </th>
                ))}
              <th className="px-2 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const row = board.get(person.userId);
              return (
                <tr key={person.userId} className="border-t border-brand-400/30">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[200px] truncate bg-brand-600 px-2 py-2 font-bold"
                  >
                    {person.name}
                  </th>
                  <td className="px-2 py-2">
                    <LevelValue row={row} />
                  </td>
                  {expanded &&
                    sections.map((section) => {
                      const cell = row?.scores[section.slug];
                      return (
                        <td
                          key={section.id}
                          className="px-2 py-2 text-center tabular-nums"
                          title={
                            cell
                              ? `${section.name}: ${cell.score} on ${cell.assessed_on}`
                              : `${section.name}: no score`
                          }
                        >
                          {cell ? cell.score : <span className="text-brand-200">—</span>}
                        </td>
                      );
                    })}
                  <td className="px-1 py-1">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        icon={Gauge}
                        label={`Edit levels for ${person.name}`}
                        className="h-8 min-w-8 w-8 text-white hover:bg-brand-500"
                        onClick={() => onEdit(person.userId)}
                      />
                      <IconButton
                        icon={History}
                        label={`Level history for ${person.name}`}
                        className="h-8 min-w-8 w-8 text-white hover:bg-brand-500"
                        onClick={() => onHistory(person.userId)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
