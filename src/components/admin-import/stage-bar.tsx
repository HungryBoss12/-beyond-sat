export function StageBar({
  label,
  detail,
  pct,
  active,
  done,
  total,
}: {
  label: string;
  detail: string;
  pct: number;
  active: boolean;
  done: number;
  total: number;
}) {
  return (
    <div
      className={
        "rounded-lg border px-3 py-2 " +
        (active ? "border-brand-200/70 bg-brand-900/80" : "border-brand-400/30 bg-brand-900/40")
      }
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white">
          {label}
          {active ? " · running" : done >= total && total > 0 ? " · done" : ""}
        </span>
        <span className="text-[10px] font-semibold text-brand-200">
          {done}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-800">
        <div
          className={
            "h-full rounded-full transition-[width] duration-300 " +
            (active ? "bg-brand-200" : "bg-brand-400")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-brand-200">{detail}</div>
    </div>
  );
}
