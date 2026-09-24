import { Link } from "@tanstack/react-router";
import type { BankFormat } from "@/lib/admin/question";

/** Ordinary | SQB segment control shared by admin Questions / Tests / hub. */
export function BankFormatSegment({
  value,
  onChange,
  ordinaryTo,
  sqbTo,
}: {
  value: BankFormat;
  onChange?: (next: BankFormat) => void;
  ordinaryTo?: string;
  sqbTo?: string;
}) {
  const base =
    "tap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors";
  const active = "bg-brand-400 text-white";
  const idle = "bg-brand-600 text-brand-100 hover:bg-brand-500 hover:text-white";

  if (ordinaryTo && sqbTo) {
    return (
      <div className="inline-flex gap-1 rounded-full bg-brand-800/60 p-1">
        <Link to={ordinaryTo} className={`${base} ${value === "ordinary" ? active : idle}`}>
          Ordinary
        </Link>
        <Link to={sqbTo} className={`${base} ${value === "sqb" ? active : idle}`}>
          SQB
        </Link>
      </div>
    );
  }

  return (
    <div className="inline-flex gap-1 rounded-full bg-brand-800/60 p-1">
      <button
        type="button"
        onClick={() => onChange?.("ordinary")}
        className={`${base} ${value === "ordinary" ? active : idle}`}
      >
        Ordinary
      </button>
      <button
        type="button"
        onClick={() => onChange?.("sqb")}
        className={`${base} ${value === "sqb" ? active : idle}`}
      >
        SQB
      </button>
    </div>
  );
}
