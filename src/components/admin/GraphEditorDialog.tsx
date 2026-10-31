import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, Circle, LineChart, Plus, Trash2, X } from "lucide-react";
import { MixedMathEditor } from "@/components/MixedMathEditor";
import { QuestionGraph as GraphPlot } from "@/components/questions/QuestionGraph";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  blankGraph,
  parseGraph,
  serializeGraph,
  type GraphDraw,
  type QuestionGraph,
} from "@/lib/import/graph-text";

const CONTROL =
  "w-full rounded-lg border border-brand-400/50 bg-brand-900 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

const DRAWS: { id: GraphDraw; label: string; icon: typeof Circle }[] = [
  { id: "dots", label: "Dots", icon: Circle },
  { id: "line", label: "Line", icon: LineChart },
  { id: "bars", label: "Bars", icon: BarChart3 },
];

/** Add or edit a question graph in a dialog on the page. */
export function GraphEditorDialog({
  open,
  graphText,
  math,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  graphText: string;
  math: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (graphText: string) => void;
}) {
  const [graph, setGraph] = useState<QuestionGraph>(blankGraph);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setGraph(graphText.trim() ? parseGraph(graphText) : blankGraph());
    }
    wasOpen.current = open;
  }, [open, graphText]);

  function patch(partial: Partial<QuestionGraph>) {
    setGraph((current) => ({ ...current, ...partial }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden border-brand-400/40 bg-brand-800 p-0 text-white sm:rounded-2xl [&>button]:!text-white">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-white">Graph</DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <AxisFields
              title="X axis"
              label={graph.xLabel}
              min={graph.xMin}
              max={graph.xMax}
              ticks={graph.xTicks}
              math={math}
              onLabel={(xLabel) => patch({ xLabel })}
              onMin={(xMin) => patch({ xMin })}
              onMax={(xMax) => patch({ xMax })}
              onTicks={(xTicks) => patch({ xTicks })}
            />
            <AxisFields
              title="Y axis"
              label={graph.yLabel}
              min={graph.yMin}
              max={graph.yMax}
              ticks={graph.yTicks}
              math={math}
              onLabel={(yLabel) => patch({ yLabel })}
              onMin={(yMin) => patch({ yMin })}
              onMax={(yMax) => patch({ yMax })}
              onTicks={(yTicks) => patch({ yTicks })}
            />
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-100">Points</span>
                <button
                  type="button"
                  onClick={() => patch({ points: [...graph.points, { x: "", y: "" }] })}
                  className="tap inline-flex items-center gap-1 rounded-lg bg-brand-900 px-2 py-1 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Add point
                </button>
              </div>
              <div className="space-y-2">
                {graph.points.map((point, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      className={CONTROL}
                      value={point.x}
                      inputMode="decimal"
                      aria-label={`Point ${index + 1} x`}
                      placeholder="x"
                      onChange={(event) => {
                        const points = graph.points.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, x: event.target.value } : item,
                        );
                        patch({ points });
                      }}
                    />
                    <input
                      className={CONTROL}
                      value={point.y}
                      inputMode="decimal"
                      aria-label={`Point ${index + 1} y`}
                      placeholder="y"
                      onChange={(event) => {
                        const points = graph.points.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, y: event.target.value } : item,
                        );
                        patch({ points });
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Remove point ${index + 1}`}
                      onClick={() => patch({ points: graph.points.filter((_, itemIndex) => itemIndex !== index) })}
                      className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-900 text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">Draw</span>
              <div className="flex flex-wrap gap-2">
                {DRAWS.map((draw) => {
                  const Icon = draw.icon;
                  const selected = graph.draw === draw.id;
                  return (
                    <button
                      key={draw.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => patch({ draw: draw.id })}
                      className={
                        "tap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold " +
                        (selected ? "bg-brand-400 text-white" : "bg-brand-900 text-brand-100")
                      }
                    >
                      <Icon className="h-3.5 w-3.5" /> {draw.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={graph.grid}
                onChange={(event) => patch({ grid: event.target.checked })}
              />
              Grid
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">Lines</span>
              <MixedMathEditor
                math={math}
                value={graph.lines}
                onChange={(lines) => patch({ lines })}
                rows={2}
                placeholder="a straight line through those points"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={graph.show}
                onChange={(event) => patch({ show: event.target.checked })}
              />
              Students see this graph
            </label>
          </div>
          <GraphPlot graph={graph} math={math} />
        </div>
        <div className="flex justify-end gap-2 border-t border-brand-400/40 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="tap inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onDone(serializeGraph(graph));
              onOpenChange(false);
            }}
            className="tap inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-white"
          >
            <Check className="h-4 w-4" /> Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AxisFields({
  title,
  label,
  min,
  max,
  ticks,
  math,
  onLabel,
  onMin,
  onMax,
  onTicks,
}: {
  title: string;
  label: string;
  min: string;
  max: string;
  ticks: string;
  math: boolean;
  onLabel: (value: string) => void;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  onTicks: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wider text-brand-100">{title}</legend>
      <MixedMathEditor math={math} singleLine value={label} onChange={onLabel} placeholder="Label" />
      <div className="grid grid-cols-3 gap-2">
        <input className={CONTROL} value={min} inputMode="decimal" aria-label={`${title} minimum`} placeholder="Min" onChange={(event) => onMin(event.target.value)} />
        <input className={CONTROL} value={max} inputMode="decimal" aria-label={`${title} maximum`} placeholder="Max" onChange={(event) => onMax(event.target.value)} />
        <input className={CONTROL} value={ticks} aria-label={`${title} ticks`} placeholder="Ticks" onChange={(event) => onTicks(event.target.value)} />
      </div>
    </fieldset>
  );
}
