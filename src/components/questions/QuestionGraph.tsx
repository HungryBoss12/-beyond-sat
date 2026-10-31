import { MathText } from "@/components/MathText";
import type { QuestionGraph as Graph } from "@/lib/import/graph-text";

const PAD_L = 46;
const PAD_R = 16;
const PAD_T = 14;
const PAD_B = 32;
const WIDTH = 360;
const HEIGHT = 250;
const PLOT_W = WIDTH - PAD_L - PAD_R;
const PLOT_H = HEIGHT - PAD_T - PAD_B;

function num(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tickValues(min: number, max: number, raw: string): number[] {
  const listed = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= min && value <= max);
  if (listed.length > 0) return listed.slice(0, 12);
  return [0, 1, 2, 3, 4].map((step) => min + ((max - min) * step) / 4);
}

function tickLabel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 10) / 10;
  return String(rounded);
}

/** Axes, ticks, and the points, line, or bars from a question graph. */
export function QuestionGraph({ graph, math = true }: { graph: Graph; math?: boolean }) {
  let xMin = num(graph.xMin, 0);
  let xMax = num(graph.xMax, 10);
  let yMin = num(graph.yMin, 0);
  let yMax = num(graph.yMax, 10);
  if (xMax <= xMin) xMax = xMin + 1;
  if (yMax <= yMin) yMax = yMin + 1;

  const xTicks = tickValues(xMin, xMax, graph.xTicks);
  const yTicks = tickValues(yMin, yMax, graph.yTicks);
  const xPx = (value: number) => PAD_L + ((value - xMin) / (xMax - xMin)) * PLOT_W;
  const yPx = (value: number) => PAD_T + (1 - (value - yMin) / (yMax - yMin)) * PLOT_H;
  const points = graph.points.flatMap((point) => {
    const x = Number(point.x);
    const y = Number(point.y);
    return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : [];
  });
  const axisX = xMin <= 0 && xMax >= 0 ? 0 : xMin;
  const axisY = yMin <= 0 && yMax >= 0 ? 0 : yMin;
  const barW = Math.min(24, PLOT_W / Math.max(points.length * 2, 4));

  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900">
      {graph.yLabel.trim() ? (
        <MathText math={math} className="mb-1 block text-center text-sm font-semibold">
          {graph.yLabel}
        </MathText>
      ) : null}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Graph">
        {graph.grid
          ? yTicks.map((tick) => (
              <line
                key={`gy-${tick}`}
                x1={PAD_L}
                x2={PAD_L + PLOT_W}
                y1={yPx(tick)}
                y2={yPx(tick)}
                stroke="#e2e8f0"
              />
            ))
          : null}
        {graph.grid
          ? xTicks.map((tick) => (
              <line
                key={`gx-${tick}`}
                y1={PAD_T}
                y2={PAD_T + PLOT_H}
                x1={xPx(tick)}
                x2={xPx(tick)}
                stroke="#e2e8f0"
              />
            ))
          : null}
        <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={yPx(axisY)} y2={yPx(axisY)} stroke="#0f172a" strokeWidth="1.5" />
        <line y1={PAD_T} y2={PAD_T + PLOT_H} x1={xPx(axisX)} x2={xPx(axisX)} stroke="#0f172a" strokeWidth="1.5" />
        {xTicks.map((tick) => (
          <text key={`xt-${tick}`} x={xPx(tick)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="#334155">
            {tickLabel(tick)}
          </text>
        ))}
        {yTicks.map((tick) => (
          <text key={`yt-${tick}`} x={PAD_L - 8} y={yPx(tick) + 4} textAnchor="end" fontSize="11" fill="#334155">
            {tickLabel(tick)}
          </text>
        ))}
        {graph.draw === "bars"
          ? points.map((point, index) => {
              const top = Math.min(yPx(point.y), yPx(axisY));
              const height = Math.abs(yPx(point.y) - yPx(axisY));
              return (
                <rect
                  key={`bar-${index}`}
                  x={xPx(point.x) - barW / 2}
                  y={top}
                  width={barW}
                  height={Math.max(height, 1)}
                  fill="#1d4ed8"
                />
              );
            })
          : null}
        {graph.draw === "line" && points.length > 1 ? (
          <polyline
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="2"
            points={points.map((point) => `${xPx(point.x)},${yPx(point.y)}`).join(" ")}
          />
        ) : null}
        {graph.draw !== "bars"
          ? points.map((point, index) => (
              <circle key={`dot-${index}`} cx={xPx(point.x)} cy={yPx(point.y)} r="4.5" fill="#1d4ed8" />
            ))
          : null}
      </svg>
      {graph.xLabel.trim() ? (
        <MathText math={math} className="mt-1 block text-center text-sm font-semibold">
          {graph.xLabel}
        </MathText>
      ) : null}
      {graph.lines.trim() ? (
        <MathText math={math} className="mt-1 block text-center text-sm text-slate-700">
          {graph.lines}
        </MathText>
      ) : null}
    </figure>
  );
}
