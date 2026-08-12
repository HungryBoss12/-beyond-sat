import { Loader2, ScanEye, Square } from "lucide-react";
import { Field } from "./field";
import { StageBar } from "./stage-bar";
import { CONTROL_CLASS, type VisionState } from "./types";

/**
 * The scanned-PDF panel.
 *
 * Two-stage progress: (1) Gemini Pro extracts questions, (2) Gemini Flash
 * rechecks the same page. Page range stays front and centre so long scans are
 * run in batches.
 */
export function VisionPanel({
  state,
  onChange,
  onStart,
  onStop,
}: {
  state: VisionState;
  onChange: (patch: Partial<VisionState>) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const p = state.progress;
  const rangePages = Math.max(1, state.to - state.from + 1);
  const stage1Pct = p ? Math.min(100, Math.round((p.stage1Done / rangePages) * 100)) : 0;
  const stage2Pct = p ? Math.min(100, Math.round((p.stage2Done / rangePages) * 100)) : 0;
  const overallPct = p
    ? Math.min(100, Math.round(((p.stage1Done + p.stage2Done) / (rangePages * 2)) * 100))
    : 0;

  return (
    <div className="space-y-3 rounded-xl border border-brand-400/40 bg-brand-800 p-4">
      <div className="flex items-start gap-2.5">
        <ScanEye className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
        <div className="text-xs leading-relaxed text-brand-100">
          <strong className="text-white">This is a scan.</strong> Each page is read twice: Gemini
          Pro extracts questions (numbers optional), then Gemini Flash rechecks the same page. Check
          every row in the preview before importing. Run a small range first.
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="From page">
          <input
            type="number"
            min={1}
            max={state.pages}
            value={state.from}
            disabled={state.running}
            onChange={(e) => onChange({ from: Math.max(1, Number(e.target.value) || 1) })}
            className={CONTROL_CLASS + " w-24 disabled:opacity-40"}
          />
        </Field>
        <Field label="To page">
          <input
            type="number"
            min={1}
            max={state.pages}
            value={state.to}
            disabled={state.running}
            onChange={(e) =>
              onChange({ to: Math.min(state.pages, Math.max(1, Number(e.target.value) || 1)) })
            }
            className={CONTROL_CLASS + " w-24 disabled:opacity-40"}
          />
        </Field>
        <span className="pb-2 text-xs text-brand-200">of {state.pages}</span>
        <div className="pb-0.5">
          {state.running ? (
            <button
              onClick={onStop}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-300/60 bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button
              onClick={onStart}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-800"
            >
              <ScanEye className="h-4 w-4" /> Read pages {state.from}–{state.to}
            </button>
          )}
        </div>
      </div>

      {state.running && (
        <div className="space-y-3" role="status" aria-live="polite" aria-label="Import progress">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-brand-100">
              <span>Overall</span>
              <span>{overallPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-900">
              <div
                className="h-full rounded-full bg-brand-200 transition-[width] duration-300"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StageBar
              label="1 · Extract"
              detail="Gemini 2.5 Pro"
              pct={stage1Pct}
              active={p?.stage === 1}
              done={p?.stage1Done ?? 0}
              total={rangePages}
            />
            <StageBar
              label="2 · Recheck"
              detail="Gemini 2.5 Flash"
              pct={stage2Pct}
              active={p?.stage === 2}
              done={p?.stage2Done ?? 0}
              total={rangePages}
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-brand-100">
            <Loader2 className="h-3 w-3 animate-spin" />
            {p
              ? `Page ${p.page} · Stage ${p.stage} (${p.stageLabel}) · ${p.found} question${p.found === 1 ? "" : "s"} so far`
              : "Rendering the first page…"}
          </div>
        </div>
      )}
    </div>
  );
}
