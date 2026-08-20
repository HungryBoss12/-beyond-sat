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

async function inflateEntryBytes(buf: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buf);
  if (view.getUint32(entry.localHeaderOffset, true) !== LFH_SIG) {
    throw new Error("That .docx is corrupt — a local file header is missing.");
  }
  const nameLen = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLen = view.getUint16(entry.localHeaderOffset + 28, true);
  const start = entry.localHeaderOffset + 30 + nameLen + extraLen;
  const raw = new Uint8Array(buf, start, entry.compressedSize);

  if (entry.method === 0) return raw;
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
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateEntry(buf: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const bytes = await inflateEntryBytes(buf, entry);
  return new TextDecoder("utf-8").decode(bytes);
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
function paragraphContent(xml: string, ctx: DocxContext): { text: string; images: Blob[] } {
  const token =
    /<w:tab\s*\/>|<w:br\s*\/>|<w:noBreakHyphen\s*\/>|<(?:w|m):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w|m):t>|<w:drawing[\s>]|<w:pict[\s>]|<v:imagedata[\s>]|r:embed="([^"]+)"/g;
  let out = "";
  let figure = false;
  const embedIds: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = token.exec(xml))) {
    const head = m[0];
    if (head.startsWith("<w:tab")) out += "\t";
    else if (head.startsWith("<w:br")) out += "\n";
    else if (head.startsWith("<w:noBreakHyphen")) out += "-";
    else if (head.startsWith('r:embed="')) embedIds.push(m[1]);
    else if (
      head.startsWith("<w:drawing") ||
      head.startsWith("<w:pict") ||
      head.startsWith("<v:imagedata")
    ) {
      figure = true;
    } else out += decodeEntities(m[1] ?? "");
  }

  const images = resolveEmbeds(embedIds, ctx);
  if (figure && images.length === 0) {
    out += (out.trim() ? " " : "") + FIGURE_MARKER;
  }
  return { text: out, images };
}

function paragraphText(xml: string, ctx: DocxContext): string {
  return paragraphContent(xml, ctx).text;
}

export const FIGURE_MARKER = "[FIGURE NEEDED — add an image URL for this question]";

type DocxContext = {
  rels: Map<string, string>;
  media: Map<string, Uint8Array>;
};

function resolveMediaPath(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  if (target.startsWith("word/")) return target;
  return `word/${target.replace(/^\.\.\//, "")}`;
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "emf" || ext === "wmf") return "image/emf";
  return "image/jpeg";
}

function resolveEmbeds(ids: string[], ctx: DocxContext): Blob[] {
  const out: Blob[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const target = ctx.rels.get(id);
    if (!target) continue;
    const path = resolveMediaPath(target);
    const bytes = ctx.media.get(path);
    if (!bytes?.length) continue;
    out.push(new Blob([bytes as BlobPart], { type: mimeFromPath(path) }));
  }
  return out;
}

async function readDocxContext(
  buf: ArrayBuffer,
  entries: Map<string, ZipEntry>,
): Promise<DocxContext> {
  const rels = new Map<string, string>();
  const relEntry = entries.get("word/_rels/document.xml.rels");
  if (relEntry) {
    const xml = await inflateEntry(buf, relEntry);
    const re = /<Relationship\b([^/>]*)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const attrs = m[1];
      const id = /Id="([^"]+)"/.exec(attrs)?.[1];
      const target = /Target="([^"]+)"/.exec(attrs)?.[1];
      if (id && target) rels.set(id, target);
    }
  }

  const media = new Map<string, Uint8Array>();
  for (const [name, entry] of entries) {
    if (!name.startsWith("word/media/")) continue;
    media.set(name, await inflateEntryBytes(buf, entry));
  }

  return { rels, media };
}

function cellText(xml: string, ctx: DocxContext): string {
  const parts: string[] = [];
  const re = /<w:p(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const end = findClose(xml, m.index + m[0].length, "w:p");
    const t = paragraphText(xml.slice(m.index, end), ctx).trim();
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
function tableBlocks(xml: string, ctx: DocxContext): DocxSourceBlock[] {
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
      cells.push(cellText(rowXml.slice(cm.index, cellEnd), ctx).replace(/\|/g, "\\|"));
      cellRe.lastIndex = cellEnd;
    }
    if (cells.length) rows.push(cells);
    rowRe.lastIndex = rowEnd;
  }

  if (rows.length === 0) return [];
  if (rows.every((r) => r.length <= 1)) {
    return rows
      .map((r) => r[0] ?? "")
      .filter(Boolean)
      .map((text) => ({ text }));
  }

  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
  const [head, ...body] = rows;
  return [
    {
      text: [
        `| ${pad(head).join(" | ")} |`,
        `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
        ...body.map((r) => `| ${pad(r).join(" | ")} |`),
      ].join("\n"),
    },
  ];
}

export type DocxSourceBlock = {
  text: string;
  images?: Blob[];
};

/**
 * Walk the body's direct children in document order. A single global regex for
 * `<w:p>` would also match the paragraphs *inside* every table cell, duplicating
 * the table's text as loose blocks — hence the scanner.
 */
export function documentXmlToBlocks(xml: string, ctx: DocxContext): DocxSourceBlock[] {
  const bodyStart = xml.indexOf("<w:body");
  const scope = bodyStart === -1 ? xml : xml.slice(bodyStart);
  const blocks: DocxSourceBlock[] = [];
  const next = /<w:p(?=[\s/>])|<w:tbl(?=[\s/>])/g;
  let m: RegExpExecArray | null;

  while ((m = next.exec(scope))) {
    if (m[0].startsWith("<w:tbl")) {
      const end = findClose(scope, m.index + m[0].length, "w:tbl");
      blocks.push(...tableBlocks(scope.slice(m.index, end), ctx));
      next.lastIndex = end;
      continue;
    }
    /* `<w:p/>` is a legal empty paragraph and has no close tag to find. */
    const selfClosing = /^<w:p\s*\/>/.test(scope.slice(m.index));
    const end = selfClosing
      ? m.index + scope.slice(m.index).indexOf(">") + 1
      : findClose(scope, m.index + m[0].length, "w:p");
    const { text, images } = paragraphContent(scope.slice(m.index, end), ctx);
    const trimmed = text.trim();
    if (trimmed || images.length) {
      blocks.push({
        text: trimmed,
        ...(images.length ? { images } : {}),
      });
    }
    next.lastIndex = end;
  }
  return blocks;
}

/** Read a `.docx` File/Blob into ordered text blocks with embedded images. */
export async function readDocx(file: Blob): Promise<DocxSourceBlock[]> {
  const buf = await file.arrayBuffer();
  const entries = readCentralDirectory(buf);
  const entry = entries.get("word/document.xml");
  if (!entry) {
    throw new Error(
      "That zip has no word/document.xml — it may be a .doc renamed to .docx, or a different Office format. Re-save it as .docx from Word.",
    );
  }
  const ctx = await readDocxContext(buf, entries);
  return documentXmlToBlocks(await inflateEntry(buf, entry), ctx);
}
