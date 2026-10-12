import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SupportCountdown } from "@/components/support/SupportCountdown";
import { startTestSetSession } from "@/lib/session";
import { formatDay, formatWhen, subjectLabel, type SupportSession } from "@/lib/support/api";

const STATUS_LABEL: Record<SupportSession["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  rejected: "Declined",
};

export function SupportSessionCard({
  session,
  onCancel,
  onChangeTime,
  cancelling = false,
}: {
  session: SupportSession;
  onCancel?: (session: SupportSession) => void;
  onChangeTime?: (session: SupportSession) => void;
  cancelling?: boolean;
}) {
  const initials = session.teacher_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <li className="rounded-xl bg-brand-800 px-3 py-3 text-sm text-white">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-400 text-xs font-black"
        >
          {initials || "T"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">
              {subjectLabel(session.subject)} · {session.teacher_name}
            </p>
            <span className="rounded-full bg-brand-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {STATUS_LABEL[session.status]}
            </span>
          </div>
          <p className="mt-1 text-xs">
            {session.starts_at
              ? `${formatWhen(session.starts_at)}${session.ends_at ? ` – ${formatWhen(session.ends_at)}` : ""}`
              : formatDay(session.preferred_on)
                ? `Preferred day ${formatDay(session.preferred_on)}`
                : "Waiting for a teacher"}
          </p>
          <SupportCountdown startsAt={session.starts_at} />
          {session.notes && <p className="mt-2 text-xs">{session.notes}</p>}
          {session.passes?.map((pass, index) => (
            <p key={`${pass.teacher_name}-${index}`} className="mt-2 text-xs">
              {pass.teacher_name} declined{pass.note ? `: ${pass.note}` : "."}
            </p>
          ))}
          {session.rejection_reason && <p className="mt-2 text-xs">Note: {session.rejection_reason}</p>}
          {session.materials.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {session.materials.map((item) => (
                <li key={item.id}>
                  <MaterialLink item={item} />
                </li>
              ))}
            </ul>
          )}
          {session.status === "confirmed" && onChangeTime && (
            <button
              type="button"
              className="mt-2 text-xs font-bold underline"
              onClick={() => onChangeTime(session)}
            >
              {session.starts_at ? "Change time" : "Set time"}
            </button>
          )}
          {session.status === "pending" && onCancel && (
            <button
              type="button"
              disabled={cancelling}
              className="mt-2 text-xs font-bold underline disabled:opacity-40"
              onClick={() => onCancel(session)}
            >
              Cancel request
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function MaterialLink({ item }: { item: SupportSession["materials"][number] }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (item.test_id) {
    return (
      <button
        type="button"
        disabled={busy}
        className="font-bold underline disabled:opacity-40"
        onClick={() => {
          const testId = item.test_id;
          if (!testId) return;
          setBusy(true);
          void startTestSetSession(testId)
            .then(({ sessionId }) =>
              navigate({ to: "/practice/session/$id", params: { id: sessionId } }),
            )
            .catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : "Could not open the test"),
            )
            .finally(() => setBusy(false));
        }}
      >
        {item.title}
      </button>
    );
  }
  if (item.material_url?.startsWith("https://")) {
    return (
      <a className="font-bold underline" href={item.material_url} target="_blank" rel="noopener noreferrer">
        {item.title}
      </a>
    );
  }
  return <span>{item.title}</span>;
}
