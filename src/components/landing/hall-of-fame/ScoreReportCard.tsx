import type { HallReport } from "./schema";

function SectionScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black text-slate-900">{value}</div>
    </div>
  );
}

/** A paper-style score report. Layout only; the figures are whatever the admin entered. */
export function ScoreReportCard({ report }: { report: HallReport }) {
  const total = report.readingWriting + report.math;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-panel md:p-8">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Score report
          </div>
          <div className="mt-1 truncate text-lg font-bold text-slate-900">{report.name}</div>
          {report.date && <div className="text-xs text-slate-500">{report.date}</div>}
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</div>
          <div className="text-4xl font-black leading-none text-brand-600">{total}</div>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SectionScore label="Reading & Writing" value={report.readingWriting} />
        <SectionScore label="Math" value={report.math} />
      </div>
      {report.locator && (
        <div className="mt-4 text-[11px] text-slate-400">Locator: {report.locator}</div>
      )}
    </article>
  );
}
