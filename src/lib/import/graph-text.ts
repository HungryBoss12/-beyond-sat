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

/** Wrap a vision transcription so the editor can find it later. */
export function graphMarkdownBlock(inner: string): string {
  const body = inner.trim();
  if (!body) return "";
  if (body.includes(OPEN) && body.includes(CLOSE)) return body;
  return `${OPEN}\n${body}\n${CLOSE}`;
}
