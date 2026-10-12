import { subjectLabel, type SupportSession } from "@/lib/support/api";
import { nextSessionLabel, supportStats } from "@/lib/support/stats";

export function SupportStats({ sessions }: { sessions: SupportSession[] }) {
  const stats = supportStats(sessions);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card label="Attended" value={String(stats.attended)} detail="Completed sessions" />
      <Card
        label="This month"
        value={String(stats.thisMonth)}
        detail={
          stats.weekStreak === 0
            ? "No weekly streak yet"
            : `${stats.weekStreak} week${stats.weekStreak === 1 ? "" : "s"} in a row`
        }
      />
      <Card
        label="Next"
        value={stats.next ? nextSessionLabel(stats.next) : "None scheduled"}
        detail={
          stats.next
            ? `${subjectLabel(stats.next.subject)} · ${stats.next.teacher_name}`
            : "Take an open session"
        }
      />
    </div>
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white shadow-panel">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-100">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-brand-100">{detail}</p>
    </div>
  );
}
