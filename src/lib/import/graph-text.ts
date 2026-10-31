const OPEN = "[Graph]";
const CLOSE = "[/Graph]";

/** Pull the graph transcription out of a passage. Empty when there is none. */
export function extractGraphText(prompt: string): string {
  const start = prompt.indexOf(OPEN);
  if (start < 0) return "";
  const end = prompt.indexOf(CLOSE, start + OPEN.length);
  if (end < 0) return "";
  return prompt.slice(start + OPEN.length, end).trim();
}

/** Write graph text back into the passage without touching the rest of it. */
export function replaceGraphText(prompt: string, graph: string): string {
  const body = graph.trim();
  const start = prompt.indexOf(OPEN);
  const end = start >= 0 ? prompt.indexOf(CLOSE, start + OPEN.length) : -1;
  const block = body ? `${OPEN}\n${body}\n${CLOSE}` : "";
  if (start >= 0 && end >= 0) {
    const before = prompt.slice(0, start).replace(/\n+$/, "");
    const after = prompt.slice(end + CLOSE.length).replace(/^\n+/, "");
    if (!block) return [before, after].filter(Boolean).join("\n\n");
    return [before, block, after].filter(Boolean).join("\n\n");
  }
  if (!block) return prompt;
  const base = prompt.trim();
  return base ? `${base}\n\n${block}` : block;
}

export type GraphDraw = "dots" | "line" | "bars";

export type GraphPoint = { x: string; y: string };

/** One question graph. Numbers stay strings until the plot reads them. */
export type QuestionGraph = {
  xLabel: string;
  xMin: string;
  xMax: string;
  xTicks: string;
  yLabel: string;
  yMin: string;
  yMax: string;
  yTicks: string;
  points: GraphPoint[];
  lines: string;
  draw: GraphDraw;
  grid: boolean;
  show: boolean;
};

/** A new graph: axes 0 to 10, dots, grid on, and students see it. */
export function blankGraph(): QuestionGraph {
  return {
    xLabel: "",
    xMin: "0",
    xMax: "10",
    xTicks: "",
    yLabel: "",
    yMin: "0",
    yMax: "10",
    yTicks: "",
    points: [],
    lines: "",
    draw: "dots",
    grid: true,
    show: true,
  };
}

function parseAxis(value: string): { label: string; min: string; max: string; ticks: string } {
  const ticksAt = value.search(/,\s*ticks\b/i);
  const main = (ticksAt >= 0 ? value.slice(0, ticksAt) : value).trim();
  const ticks = ticksAt >= 0 ? value.slice(value.search(/\bticks\b/i) + "ticks".length).trim() : "";
  const withLabel = main.match(/^(.*?),\s*(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)\s*$/);
  if (withLabel) return { label: withLabel[1].trim(), min: withLabel[2], max: withLabel[3], ticks };
  const rangeOnly = main.match(/^(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)\s*$/);
  if (rangeOnly) return { label: "", min: rangeOnly[1], max: rangeOnly[2], ticks };
  return { label: main, min: "", max: "", ticks };
}

function parsePoints(value: string): GraphPoint[] {
  const points: GraphPoint[] = [];
  const pattern = /\(\s*([^,)]+?)\s*,\s*([^)]+?)\s*\)/g;
  for (const match of value.matchAll(pattern)) {
    points.push({ x: match[1].trim(), y: match[2].trim() });
  }
  return points;
}

function parseDraw(value: string): GraphDraw {
  const text = value.trim().toLowerCase();
  if (text === "line" || text === "bars") return text;
  return "dots";
}

/** Read a graph block body. A missing show line stays hidden. */
export function parseGraph(text: string): QuestionGraph {
  const graph = blankGraph();
  graph.show = false;
  let sawShow = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const split = line.match(/^(x-axis|y-axis|points|lines|draw|grid|show):\s*(.*)$/i);
    if (!split) continue;
    const key = split[1].toLowerCase();
    const value = split[2].trim();
    if (key === "x-axis" || key === "y-axis") {
      const axis = parseAxis(value);
      if (key === "x-axis") {
        graph.xLabel = axis.label;
        graph.xMin = axis.min;
        graph.xMax = axis.max;
        graph.xTicks = axis.ticks;
      } else {
        graph.yLabel = axis.label;
        graph.yMin = axis.min;
        graph.yMax = axis.max;
        graph.yTicks = axis.ticks;
      }
    } else if (key === "points") graph.points = parsePoints(value);
    else if (key === "lines") graph.lines = value;
    else if (key === "draw") graph.draw = parseDraw(value);
    else if (key === "grid") graph.grid = value.toLowerCase() !== "off";
    else if (key === "show") {
      sawShow = true;
      graph.show = value.toLowerCase() === "yes";
    }
  }
  if (!sawShow) graph.show = false;
  return graph;
}

function axisLine(name: "x-axis" | "y-axis", label: string, min: string, max: string, ticks: string): string {
  const range = min.trim() || max.trim() ? `${min.trim()} to ${max.trim()}` : "";
  const head = [label.trim(), range].filter(Boolean).join(", ");
  const tick = ticks.trim() ? `, ticks ${ticks.trim()}` : "";
  return `${name}: ${head}${tick}`;
}

/** Write the graph back as the four lines plus draw, grid, and show. */
export function serializeGraph(graph: QuestionGraph): string {
  const points = graph.points
    .filter((point) => point.x.trim() || point.y.trim())
    .map((point) => `(${point.x.trim()}, ${point.y.trim()})`)
    .join("; ");
  return [
    axisLine("x-axis", graph.xLabel, graph.xMin, graph.xMax, graph.xTicks),
    axisLine("y-axis", graph.yLabel, graph.yMin, graph.yMax, graph.yTicks),
    `points: ${points}`,
    `lines: ${graph.lines.trim()}`,
    `draw: ${graph.draw}`,
    `grid: ${graph.grid ? "on" : "off"}`,
    `show: ${graph.show ? "yes" : "no"}`,
  ].join("\n");
}

/** The graph students should see, or null when the block is hidden or missing. */
export function studentSeesGraph(prompt: string): QuestionGraph | null {
  const body = extractGraphText(prompt);
  if (!body) return null;
  const graph = parseGraph(body);
  return graph.show ? graph : null;
}

/** Wrap a vision transcription so the editor can find it later. */
export function graphMarkdownBlock(inner: string): string {
  const body = inner.trim();
  if (!body) return "";
  if (body.includes(OPEN) && body.includes(CLOSE)) return body;
  return `${OPEN}\n${body}\n${CLOSE}`;
}
