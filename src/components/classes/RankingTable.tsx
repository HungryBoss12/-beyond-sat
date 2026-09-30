import { useMemo, useState } from "react";
import { Medal, Trophy } from "lucide-react";
import { toast } from "sonner";
import { RankBadge } from "@/components/classes/RankBadge";
import {
  clampScore,
  compareRanked,
  placeFor,
  rankFor,
  totalScore,
  type RankLetter,
} from "@/lib/classes/ranking";
import { saveStudentScore } from "@/lib/classes/classroom";
import { CLASS_CONTROL } from "./control";

export type RankStudent = { userId: string; name: string; rw: number | null; math: number | null };

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
    : 0;

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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs font-bold text-brand-100">
        {(["S", "A", "B", "C", "D"] as RankLetter[]).map((letter) => (
          <span key={letter}>
            {letter} {counts[letter]}
          </span>
        ))}
        <span>avg {avg}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-wider text-brand-100">
            <tr>
              <th className="py-2">#</th>
              <th>Student</th>
              <th>RW</th>
              <th>Math</th>
              <th>Total</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            {ranked.scored.map((row, index) => {
              const place = placeFor(ranked.scored, index);
              const tier = rankFor(row.total);
              return (
                <tr key={row.userId} className="border-t border-brand-400/30">
                  <td className="py-2 font-black">
                    {place <= 3 ? (
                      <span className="inline-flex items-center gap-1">
                        {place === 1 ? (
                          <Trophy className="h-4 w-4" />
                        ) : (
                          <Medal className="h-4 w-4" />
                        )}
                        {place}
                      </span>
                    ) : (
                      place
                    )}
                  </td>
                  <td className="font-bold">{row.name}</td>
                  <ScoreCells
                    rw={row.rw}
                    math={row.math}
                    onCommit={(rwRaw, mathRaw) => void commit(row.userId, row.name, rwRaw, mathRaw)}
                  />
                  <td className="tabular-nums font-black">{row.total}</td>
                  <td>
                    <RankBadge letter={tier.letter} total={row.total} />
                  </td>
                </tr>
              );
            })}
            {ranked.unscored.map((row) => (
              <tr key={row.userId} className="border-t border-brand-400/30">
                <td className="py-2 text-brand-100">—</td>
                <td className="font-bold">{row.name}</td>
                <ScoreCells
                  rw={row.rw}
                  math={row.math}
                  onCommit={(rwRaw, mathRaw) => void commit(row.userId, row.name, rwRaw, mathRaw)}
                />
                <td className="text-brand-100">—</td>
                <td className="text-xs uppercase text-white">NOT SCORED</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-brand-100">1500+ S · 1400+ A · 1300+ B · 1200+ C · Not enough</p>
    </div>
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
      <td>
        <input
          className={CLASS_CONTROL + " w-24"}
          inputMode="numeric"
          step={10}
          value={rwText}
          onChange={(event) => setRwText(event.target.value)}
          onBlur={() => onCommit(rwText, mathText)}
        />
      </td>
      <td>
        <input
          className={CLASS_CONTROL + " w-24"}
          inputMode="numeric"
          step={10}
          value={mathText}
          onChange={(event) => setMathText(event.target.value)}
          onBlur={() => onCommit(rwText, mathText)}
        />
      </td>
    </>
  );
}
