/** Strip Anki HTML field content to plain text. */
export function stripAnkiHtml(raw: string): string {
  if (!raw.includes("<")) return raw.replace(/\u001f/g, " ").trim();

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const text = doc.body.textContent ?? "";
    return text.replace(/\u001f/g, " ").replace(/\s+/g, " ").trim();
  }

  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u001f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First non-empty line, trimmed — typical Anki "Front" field. */
export function firstLine(text: string): string {
  const line = text
    .split(/\n+/)
    .map((s) => s.trim())
    .find(Boolean);
  return line ?? text.trim();
}

/** Guess part of speech from Anki tags or definition prefix like "adj." */
export function guessPartOfSpeech(tags: string, definition: string): string {
  const tag = tags
    .split(/\s+/)
    .map((t) => t.replace(/^#/, "").toLowerCase())
    .find((t) => /^(noun|verb|adj|adjective|adv|adverb|prep|preposition)$/.test(t));
  if (tag === "adj") return "adjective";
  if (tag === "adv") return "adverb";
  if (tag === "prep") return "preposition";
  if (tag) return tag;

  const m = definition.match(/^\(([^)]+)\)/);
  if (m) {
    const pos = m[1].toLowerCase();
    if (pos.includes("adj")) return "adjective";
    if (pos.includes("adv") || pos.includes("adverb")) return "adverb";
    if (pos.includes("n")) return "noun";
    if (pos.includes("v")) return "verb";
  }
  return "noun";
}

/** Pull comma-separated synonyms from a third Anki field when present. */
export function parseSynonymsField(raw: string | undefined): string[] {
  if (!raw) return [];
  return stripAnkiHtml(raw)
    .split(/[,;|/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 40)
    .slice(0, 6);
}
