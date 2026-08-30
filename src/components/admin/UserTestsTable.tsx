import { format } from "date-fns";
import type { AdminUserSessionRow } from "@/lib/admin/users";

export function UserTestsTable({ sessions }: { sessions: AdminUserSessionRow[] }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-400/40 p-8 text-center text-sm text-brand-100">
        No test sessions yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-400/40">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-brand-800/80 text-[10px] font-bold uppercase tracking-wider text-brand-200">
          <tr>
            <th className="px-4 py-2.5">Test</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Started</th>
            <th className="px-4 py-2.5">Completed</th>
            <th className="px-4 py-2.5">Score</th>
            <th className="px-4 py-2.5">R&W / Math</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-400/30">
          {sessions.map((s) => (
            <tr key={s.id} className="text-brand-50">
              <td className="px-4 py-2.5 font-semibold text-white">
                {s.title}
                {s.in_progress && (
                  <span className="ml-2 rounded bg-brand-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-100">
                    In progress
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 capitalize">{s.type}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {format(new Date(s.started_at), "MMM d, yyyy HH:mm")}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {s.completed_at ? format(new Date(s.completed_at), "MMM d, yyyy HH:mm") : "—"}
              </td>
              <td className="px-4 py-2.5 tabular-nums">{s.score ?? "—"}</td>
              <td className="px-4 py-2.5 tabular-nums">
                {s.rw_score != null || s.math_score != null
                  ? `${s.rw_score ?? "—"} / ${s.math_score ?? "—"}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
