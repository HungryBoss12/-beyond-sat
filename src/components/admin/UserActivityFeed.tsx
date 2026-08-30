import { formatDistanceToNow } from "date-fns";
import {
  Ban,
  BookOpen,
  ClipboardCheck,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import type { AdminActivityRow } from "@/lib/admin/users";

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  test_completed: ClipboardCheck,
  test_started: PlayCircle,
  vocab_quiz: Sparkles,
  vocab_review: BookOpen,
  banned: Ban,
  unbanned: Ban,
};

export function UserActivityFeed({ events }: { events: AdminActivityRow[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-400/40 p-8 text-center text-sm text-brand-100">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-brand-400/30 rounded-xl border border-brand-400/40 bg-brand-800/40">
      {events.map((e, i) => {
        const Icon = KIND_ICON[e.kind] ?? ClipboardCheck;
        const when = e.occurred_at
          ? formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })
          : "—";
        return (
          <li key={`${e.kind}-${e.occurred_at}-${i}`} className="flex gap-3 px-4 py-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-brand-100 ring-1 ring-brand-400/40">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{e.summary}</div>
              <div className="text-xs text-brand-200">{when}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
