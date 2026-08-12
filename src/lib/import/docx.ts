/**
 * Read the text of a `.docx` in the browser, with no zip dependency.
 *
 * A `.docx` is an ordinary zip whose `word/document.xml` holds the body. The
 * whole reader is ~120 lines because the platform already ships both halves of
 * the job: `DataView` walks the zip's central directory, and
 * `DecompressionStream("deflate-raw")` inflates the entry. Pulling in JSZip
 * (~100 KB) to do the same thing would be the larger cost.
 *
 * Output is a flat `string[]` of blocks — one per Word paragraph, plus one per
 * table rendered as markdown. `parse.ts` turns blocks into questions, and the
 * PDF reader emits the same shape, so both file types converge on one preview.
 */

const EOCD_SIG = 0x06054b50;
const LFH_SIG = 0x04034b50;
const CD_SIG = 0x02014b50;

/** A file's location and encoding inside the archive. */
type ZipEntry = { name: string; method: number; compressedSize: number; localHeaderOffset: number };

/**
 * The end-of-central-directory record is the only fixed anchor in a zip, and it
 * sits at the very end — but it carries a variable-length comment, so it has to
 * be searched for backwards. 22 bytes is the record with an empty comment;
 * scanning back 64 KB more covers the maximum comment length.
 */
function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  return -1;
}

function readCentralDirectory(buf: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buf);
  const eocd = findEocd(view);
  if (eocd === -1) {
    throw new Error("That file isn't a .docx — no zip end-of-directory record was found.");
  }

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder("utf-8");
  const entries = new Map<string, ZipEntry>();

  for (let i = 0; i < count && p + 46 <= view.byteLength; i++) {
    if (view.getUint32(p, true) !== CD_SIG) break;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localHeaderOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateEntry(buf: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buf);
  if (view.getUint32(entry.localHeaderOffset, true) !== LFH_SIG) {
    throw new Error("That .docx is corrupt — a local file header is missing.");
  }
  /* The local header repeats the name and extra fields with its *own* lengths,
     which can differ from the central directory's. The data starts after those,
     not after the central copy. */
  const nameLen = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLen = view.getUint16(entry.localHeaderOffset + 28, true);
  const start = entry.localHeaderOffset + 30 + nameLen + extraLen;
  const raw = new Uint8Array(buf, start, entry.compressedSize);

  if (entry.method === 0) return new TextDecoder("utf-8").decode(raw);
  if (entry.method !== 8) {
    throw new Error(`That .docx uses an unsupported compression method (${entry.method}).`);
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This browser can't decompress .docx files. Chrome 103+, Edge 103+, Firefox 113+ or Safari 16.4+ can — or convert the file to PDF.",
    );
  }

  const stream = new Blob([raw as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// ---------------------------------------------------------------------------
// XML → blocks
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|[a-z]+);/g, (match, dec, hex) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return ENTITIES[match] ?? match;
  });
}

/**
 * Index just past the close of the element opening at `open`. Tables can contain
 * tables, so this counts depth rather than taking the first close tag — a nested
 * table would otherwise end the outer one early and spill its rows into the body.
 */
function findClose(xml: string, open: number, tag: string): number {
  const openRe = new RegExp(`<${tag}(?=[\\s/>])`, "g");
  const closeRe = new RegExp(`</${tag}>`, "g");
  let depth = 0;
  let i = open;
  for (;;) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const o = openRe.exec(xml);
    const c = closeRe.exec(xml);
    if (!c) return xml.length;
    if (o && o.index < c.index) {
      depth++;
      i = o.index + o[0].length;
      continue;
    }
    if (depth === 0) return c.index + c[0].length;
    depth--;
    i = c.index + c[0].length;
  }
}

/**
 * Flatten one paragraph's runs to text, in document order.
 *
 * `<m:t>` is included alongside `<w:t>`: OMML equations are a different
 * namespace, and dropping them turns "solve x² + 3x" into "solve  + 3x" with no
 * sign that anything went missing. The symbols come through even though the
 * layout doesn't — a reviewer can see there's an equation to fix.
 */
function paragraphText(xml: string): string {
  const token =
    /<w:tab\s*\/>|<w:br\s*\/>|<w:noBreakHyphen\s*\/>|<(?:w|m):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w|m):t>|<w:drawing[\s>]|<w:pict[\s>]|<v:imagedata[\s>]/g;
  let out = "";
  let figure = false;
  let m: RegExpExecArray | null;
  while ((m = token.exec(xml))) {
    const head = m[0];
    if (head.startsWith("<w:tab")) out += "\t";
    else if (head.startsWith("<w:br")) out += "\n";
    else if (head.startsWith("<w:noBreakHyphen")) out += "-";
    else if (
      head.startsWith("<w:drawing") ||
      head.startsWith("<w:pict") ||
      head.startsWith("<v:imagedata")
    ) {
      figure = true;
    } else out += decodeEntities(m[1] ?? "");
  }
  /* An image can't be carried through a text-only import, so it's marked rather
     than dropped. A visible marker in the preview is a question an editor can
     fix; a silently figure-less question is one that ships broken. */
  if (figure) out += (out.trim() ? " " : "") + FIGURE_MARKER;
  return out;
}

export const FIGURE_MARKER = "[FIGURE NEEDED — add an image URL for this question]";

function cellText(xml: string): string {
  const parts: string[] = [];
  const re = /<w:p(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const end = findClose(xml, m.index + m[0].length, "w:p");
    const t = paragraphText(xml.slice(m.index, end)).trim();
    if (t) parts.push(t);
    re.lastIndex = end;
  }
  return parts.join(" ");
}

/**
 * A Word table becomes a markdown table, which survives the round trip into
 * `question_text`/`prompt` and renders as a table again in the test runner.
 *
 * A single-column table is emitted as plain blocks instead: Word papers often
 * use one-column tables purely as a layout box, and rendering that as a
 * one-column markdown table would be noise around the text it holds.
 */
function tableBlocks(xml: string): string[] {
  const rows: string[][] = [];
  const rowRe = /<w:tr(?=[\s/>])/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const rowEnd = findClose(xml, rm.index + rm[0].length, "w:tr");
    const rowXml = xml.slice(rm.index, rowEnd);
    const cells: string[] = [];
    const cellRe = /<w:tc(?=[\s/>])/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowXml))) {
      const cellEnd = findClose(rowXml, cm.index + cm[0].length, "w:tc");
      cells.push(cellText(rowXml.slice(cm.index, cellEnd)).replace(/\|/g, "\\|"));
      cellRe.lastIndex = cellEnd;
    }
    if (cells.length) rows.push(cells);
    rowRe.lastIndex = rowEnd;
  }

  if (rows.length === 0) return [];
  if (rows.every((r) => r.length <= 1)) return rows.map((r) => r[0] ?? "").filter(Boolean);

  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
  const [head, ...body] = rows;
  return [
    [
      `| ${pad(head).join(" | ")} |`,
      `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
      ...body.map((r) => `| ${pad(r).join(" | ")} |`),
    ].join("\n"),
  ];
}

/**
 * Walk the body's direct children in document order. A single global regex for
 * `<w:p>` would also match the paragraphs *inside* every table cell, duplicating
 * the table's text as loose blocks — hence the scanner.
 */
export function documentXmlToBlocks(xml: string): string[] {
  const bodyStart = xml.indexOf("<w:body");
  const scope = bodyStart === -1 ? xml : xml.slice(bodyStart);
  const blocks: string[] = [];
  const next = /<w:p(?=[\s/>])|<w:tbl(?=[\s/>])/g;
  let m: RegExpExecArray | null;

  while ((m = next.exec(scope))) {
    if (m[0].startsWith("<w:tbl")) {
      const end = findClose(scope, m.index + m[0].length, "w:tbl");
      blocks.push(...tableBlocks(scope.slice(m.index, end)));
      next.lastIndex = end;
      continue;
    }
    /* `<w:p/>` is a legal empty paragraph and has no close tag to find. */
    const selfClosing = /^<w:p\s*\/>/.test(scope.slice(m.index));
    const end = selfClosing
      ? m.index + scope.slice(m.index).indexOf(">") + 1
      : findClose(scope, m.index + m[0].length, "w:p");
    const text = paragraphText(scope.slice(m.index, end)).trim();
    if (text) blocks.push(text);
    next.lastIndex = end;
  }
  return blocks;
}

/** Read a `.docx` File/Blob into ordered text blocks. */
export async function readDocx(file: Blob): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const entries = readCentralDirectory(buf);
  const entry = entries.get("word/document.xml");
  if (!entry) {
    throw new Error(
      "That zip has no word/document.xml — it may be a .doc renamed to .docx, or a different Office format. Re-save it as .docx from Word.",
    );
  }
  return documentXmlToBlocks(await inflateEntry(buf, entry));
}
