import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ScoreBadge } from "@/components/people/ScoreBadge";
import {
  clampScore,
  compareRanked,
  placeFor,
  rankFor,
  totalScore,
  type RankLetter,
} from "@/lib/classes/ranking";
import { saveStudentScore } from "@/lib/classes/classroom";
import { cn } from "@/lib/utils";

export type RankStudent = {
  userId: string;
  name: string;
  rw: number | null;
  math: number | null;
  badgeScore?: number | null;
  badgeLabel?: string | null;
  badgeColor?: string | null;
};

const LETTERS: RankLetter[] = ["S", "A", "B", "C", "D"];

const SCORE_FIELD =
  "w-16 border-b border-transparent bg-transparent px-0 py-1 text-right text-sm font-bold tabular-nums text-white outline-none placeholder:text-brand-200/80 hover:border-white/30 focus:border-white";

export function RankingTable({
  students,
  onSaved,
}: {
  students: RankStudent[];
  onSaved: () => Promise<void>;
}) {
  const ranked = useMemo(() => {
    const scored = students
      .flatMap((student) => {
        if (student.rw == null || student.math == null) return [];
        return [
          {
            ...student,
            rw: student.rw,
            math: student.math,
            total: totalScore(student.rw, student.math),
          },
        ];
      })
      .sort(compareRanked);
    const unscored = students.filter((student) => student.rw == null || student.math == null);
    return { scored, unscored };
  }, [students]);

  const counts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const row of ranked.scored) counts[rankFor(row.total).letter] += 1;
  const avg = ranked.scored.length
    ? Math.round(ranked.scored.reduce((sum, row) => sum + row.total, 0) / ranked.scored.length)
    : null;

  async function commit(userId: string, name: string, rwRaw: string, mathRaw: string) {
    const rw = clampScore(rwRaw);
    const math = clampScore(mathRaw);
    if (rw == null || math == null) return;
    try {
      await saveStudentScore(userId, rw, math);
      const total = totalScore(rw, math);
      toast.success(`${name}: ${total} → Rank ${rankFor(total).letter}`);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save score");
    }
  }

  return (
    <div className="-mx-5 -my-5 md:-mx-6 md:-my-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-100">Class ranking</p>
          <p className="mt-1 text-sm text-white">
            <span className="font-black tabular-nums">{ranked.scored.length}</span>
            <span className="text-brand-100"> scored</span>
            <span className="mx-2 text-brand-200">/</span>
            <span className="font-black tabular-nums">{students.length}</span>
            <span className="text-brand-100"> students</span>
          </p>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-white/15">
          {LETTERS.map((letter) => (
            <div key={letter} className="min-w-11 border-r border-white/10 px-3 py-2 text-center last:border-r-0">
              <div className="text-[10px] font-bold tracking-[0.16em] text-brand-100">{letter}</div>
              <div className="mt-0.5 text-lg font-black tabular-nums leading-none">{counts[letter]}</div>
            </div>
          ))}
          <div className="min-w-16 bg-white/5 px-3 py-2 text-center">
            <div className="text-[10px] font-bold tracking-[0.16em] text-brand-100">AVG</div>
            <div className="mt-0.5 text-lg font-black tabular-nums leading-none">{avg ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-100">
              <th className="w-14 px-5 py-3 font-bold md:px-6">#</th>
              <th className="py-3 font-bold">Student</th>
              <th className="w-24 py-3 text-right font-bold">RW</th>
              <th className="w-24 py-3 text-right font-bold">Math</th>
              <th className="w-24 py-3 pr-4 text-right font-bold">Total</th>
              <th className="w-16 px-5 py-3 text-right font-bold md:px-6">Rank</th>
            </tr>
          </thead>
          <tbody>
            {ranked.scored.map((row, index) => {
              const place = placeFor(ranked.scored, index);
              const letter = rankFor(row.total).letter;
              return (
                <tr key={row.userId} className="border-t border-white/10 transition-colors hover:bg-white/[0.04]">
                  <td className="px-5 py-2.5 font-black tabular-nums text-brand-100 md:px-6">{place}</td>
                  <td className="py-2.5 font-bold">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{row.name}</span>
                      <ScoreBadge score={row.badgeScore} label={row.badgeLabel} color={row.badgeColor} />
                    </span>
                  </td>
                  <ScoreCells
                    rw={row.rw}
                    math={row.math}
                    onCommit={(rwRaw, mathRaw) => void commit(row.userId, row.name, rwRaw, mathRaw)}
                  />
                  <td className="pr-4 text-right text-base font-black tabular-nums">{row.total}</td>
                  <td className="px-5 py-2.5 text-right md:px-6">
                    <RankMark letter={letter} total={row.total} />
                  </td>
                </tr>
              );
            })}
            {ranked.unscored.map((row) => (
              <tr key={row.userId} className="border-t border-white/10 transition-colors hover:bg-white/[0.04]">
                <td className="px-5 py-2.5 tabular-nums text-brand-200 md:px-6">—</td>
                <td className="py-2.5 font-bold text-brand-100">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{row.name}</span>
                    <ScoreBadge score={row.badgeScore} label={row.badgeLabel} color={row.badgeColor} />
                  </span>
                </td>
                <ScoreCells
                  rw={row.rw}
                  math={row.math}
                  onCommit={(rwRaw, mathRaw) => void commit(row.userId, row.name, rwRaw, mathRaw)}
                />
                <td className="pr-4 text-right tabular-nums text-brand-200">—</td>
                <td className="px-5 py-2.5 text-right text-brand-200 md:px-6">
                  —
                  <span className="sr-only">Not scored</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-white/10 px-5 py-3 text-[11px] font-bold tracking-[0.12em] text-brand-100 uppercase md:px-6">
        1500 S · 1400 A · 1300 B · 1200 C · below D
      </p>
    </div>
  );
}

function RankMark({ letter, total }: { letter: RankLetter; total: number }) {
  return (
    <span
      aria-label={`Rank ${letter}, ${total}`}
      className={cn(
        "inline-grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-xs font-black",
        letter === "S" ? "bg-white text-brand-900" : "bg-white/10 text-white",
      )}
    >
      {letter}
    </span>
  );
}

function ScoreCells({
  rw,
  math,
  onCommit,
}: {
  rw: number | null;
  math: number | null;
  onCommit: (rwRaw: string, mathRaw: string) => void;
}) {
  const [rwText, setRwText] = useState(rw == null ? "" : String(rw));
  const [mathText, setMathText] = useState(math == null ? "" : String(math));
  return (
    <>
      <td className="py-2 text-right">
        <input
          aria-label="Reading and writing score"
          className={SCORE_FIELD}
          inputMode="numeric"
          placeholder="—"
          value={rwText}
          onChange={(event) => setRwText(event.target.value)}
          onBlur={() => onCommit(rwText, mathText)}
        />
      </td>
      <td className="py-2 pr-1 text-right">
        <input
          aria-label="Math score"
          className={SCORE_FIELD}
          inputMode="numeric"
          placeholder="—"
          value={mathText}
          onChange={(event) => setMathText(event.target.value)}
          onBlur={() => onCommit(rwText, mathText)}
        />
      </td>
    </>
  );
}
