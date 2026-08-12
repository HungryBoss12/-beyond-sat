/**
 * Read a PDF in the browser: text layer first, page images as the fallback.
 *
 * `pdfjs-dist` is the only new dependency in the import feature, and it must
 * never enter the Worker's module graph. Every reference to it below is a
 * dynamic `import()` sitting behind `import.meta.env.SSR`, which Vite replaces
 * with a literal at build time so the branch — and the import inside it — folds
 * away entirely on the server.
 *
 * This is not belt-and-braces. `three` was imported the same way through
 * React.lazy alone, Rollup hoisted it into a chunk the SSR graph pulled in
 * statically, and its module-scope `new LoadingManager()` tripped the Workers
 * "no I/O in global scope" rule — every document request 500'd. `typeof window`
 * is not a substitute: it's evaluated at runtime, so the bundler still has to
 * keep the import. See BeyondCore.tsx:38-54.
 */

type PdfPageProxy = {
  getTextContent(): Promise<{ items: unknown[] }>;
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): {
    promise: Promise<void>;
  };
  cleanup(): void;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage(n: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
};

const SSR_MESSAGE = "PDF reading only runs in the browser.";

/**
 * Load pdf.js and point it at its worker.
 *
 * The worker URL is resolved through Vite's `?url` suffix rather than a CDN, so
 * the whole thing is same-origin and keeps working offline and behind a strict
 * connect-src.
 *
 * The guard is written as `if (!import.meta.env.SSR) { … }` rather than an early
 * `throw`, because that is the shape Rollup reliably eliminates: the literal
 * substitution turns it into `if (false)`, and the whole block — including both
 * `import()` calls — is dropped from the server build. An early throw leaves the
 * imports as *unreachable* code, which is not the same thing as *absent* code.
 */
async function loadPdfjs() {
  if (!import.meta.env.SSR) {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  }
  throw new Error(SSR_MESSAGE);
}

async function openDocument(file: Blob): Promise<{ doc: PdfDocumentProxy }> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocumentProxy;
  return { doc };
}

// ---------------------------------------------------------------------------
// Text layer
// ---------------------------------------------------------------------------

type TextItem = { str: string; transform: number[]; height: number; hasEOL?: boolean };

/**
 * Rebuild paragraphs from pdf.js text items.
 *
 * pdf.js hands back positioned fragments, not lines: a PDF has no concept of a
 * paragraph. Items are grouped into lines by their baseline y (with a tolerance,
 * because superscripts and inline math sit a point or two off), then lines are
 * joined into a block until one ends in a way that reads as a break. Getting
 * this wrong is what makes naive PDF import produce one 40,000-character
 * "question" — the block boundaries are the whole job.
 */
function itemsToBlocks(items: TextItem[]): string[] {
  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];

  for (const item of items) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    const tolerance = Math.max(2, (item.height || 10) * 0.5);
    const line = lines.find((l) => Math.abs(l.y - y) <= tolerance);
    if (line) line.parts.push({ x, str: item.str });
    else lines.push({ y, parts: [{ x, str: item.str }] });
  }

  /* PDF y grows upward, so top-to-bottom is descending. */
  lines.sort((a, b) => b.y - a.y);

  const text = lines.map((l) =>
    l.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str)
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
  );

  const blocks: string[] = [];
  let buffer = "";
  const flush = () => {
    const t = buffer.trim();
    if (t) blocks.push(t);
    buffer = "";
  };

  for (const line of text) {
    if (!line) {
      flush();
      continue;
    }
    /* A numbered question, a lettered choice, or a table row always starts its
       own block — those are exactly the boundaries the parser keys on, so they
       are never merged into the line above. */
    if (/^\s*(?:\d{1,3}\s*[.)]\s+|\(?[A-H]\s*[).]\s+|\|)/.test(line)) flush();
    buffer = buffer ? `${buffer} ${line}` : line;
    /* Terminal punctuation followed by nothing else on the line reads as the end
       of a paragraph; a line that just ran out of width does not. */
    if (/[.!?:"”'’)]\s*$/.test(line) && line.length < 90) flush();
  }
  flush();
  return blocks;
}

export type PdfTextResult = {
  blocks: string[];
  pages: number;
  /** True when the file has no extractable text — i.e. it's a scan. */
  scanned: boolean;
};

/**
 * Extract the text layer. A PDF produced from Word or LaTeX has one; a
 * photocopied paper does not, and the caller routes those to the vision path.
 *
 * "Scanned" is decided on characters per page rather than a bare zero, because
 * a scan often carries a stray header or a page number in real text and would
 * otherwise look like a text PDF with 108 empty questions.
 */
export async function readPdfText(
  file: Blob,
  onProgress?: (page: number, total: number) => void,
): Promise<PdfTextResult> {
  const { doc } = await openDocument(file);
  try {
    const all: string[] = [];
    let characters = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items as TextItem[];
      characters += items.reduce(
        (sum, i) => sum + (typeof i.str === "string" ? i.str.length : 0),
        0,
      );
      all.push(...itemsToBlocks(items));
      page.cleanup();
      onProgress?.(n, doc.numPages);
    }
    return { blocks: all, pages: doc.numPages, scanned: characters / doc.numPages < 100 };
  } finally {
    await doc.destroy();
  }
}

// ---------------------------------------------------------------------------
// Page images, for the vision fallback
// ---------------------------------------------------------------------------

export type PageImage = { page: number; dataUrl: string };

/**
 * Render pages to JPEG data URLs, one at a time.
 *
 * Sequential and cancellable on purpose. The scanned sample is 108 pages, and
 * firing those concurrently at a `:free` vision model rate-limits within
 * seconds, burning the whole document with nothing to show for it. `shouldStop`
 * is polled between pages so the Stop button ends the run at a page boundary
 * rather than mid-render.
 *
 * Scale 1.6 and quality 0.72 are a deliberate pair: high enough that 9pt exam
 * body text stays legible to a vision model, low enough that a page lands around
 * 150-250 KB. Full resolution triples the payload for no accuracy gain and makes
 * the per-request timeout the binding constraint.
 */
export async function renderPdfPages(
  file: Blob,
  opts: {
    from?: number;
    to?: number;
    onPage: (image: PageImage, index: number, total: number) => Promise<void> | void;
    shouldStop?: () => boolean;
  },
): Promise<{ rendered: number; total: number; stopped: boolean }> {
  const { doc } = await openDocument(file);
  try {
    const from = Math.max(1, opts.from ?? 1);
    const to = Math.min(doc.numPages, opts.to ?? doc.numPages);
    const total = Math.max(0, to - from + 1);
    let rendered = 0;

    for (let n = from; n <= to; n++) {
      if (opts.shouldStop?.()) return { rendered, total, stopped: true };

      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("This browser wouldn't give a 2D canvas, so PDF pages can't be rendered.");

      /* White first: a PDF page is transparent where nothing was drawn, and JPEG
         has no alpha — without this every page arrives as black on black. */
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      page.cleanup();
      /* Release the backing store immediately. 108 full-page canvases held at
         once is hundreds of megabytes and will kill the tab on a low-end laptop. */
      canvas.width = 0;
      canvas.height = 0;

      await opts.onPage({ page: n, dataUrl }, rendered, total);
      rendered++;
    }
    return { rendered, total, stopped: false };
  } finally {
    await doc.destroy();
  }
}

/** Page count without reading any content — used to size the vision run up front. */
export async function pdfPageCount(file: Blob): Promise<number> {
  const { doc } = await openDocument(file);
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}
