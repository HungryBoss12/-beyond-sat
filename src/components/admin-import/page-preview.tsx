import { useEffect, useState } from "react";
import { FileQuestion, Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CACHE_LIMIT = 24;
const pageCache = new Map<string, string>();

function cacheKey(file: File, page: number): string {
  return `${file.name}:${file.size}:${file.lastModified}:${page}`;
}

function remember(key: string, dataUrl: string) {
  if (pageCache.has(key)) pageCache.delete(key);
  pageCache.set(key, dataUrl);
  while (pageCache.size > CACHE_LIMIT) {
    const oldest = pageCache.keys().next().value;
    if (oldest == null) break;
    pageCache.delete(oldest);
  }
}

/**
 * Lazy-render one PDF page for the Review step. Cache is module-level so
 * flipping back to a question does not re-open the document.
 */
export function PagePreview({
  file,
  page,
  questionLabel,
}: {
  file: File | null;
  page: number | null | undefined;
  questionLabel: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [zoom, setZoom] = useState(1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!file || page == null || page < 1) {
      setDataUrl(null);
      setStatus("idle");
      return;
    }

    const key = cacheKey(file, page);
    const hit = pageCache.get(key);
    if (hit) {
      setDataUrl(hit);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setDataUrl(null);

    void import("@/lib/import/pdf")
      .then(({ renderPdfPage }) => renderPdfPage(file, page))
      .then((url) => {
        if (cancelled) return;
        remember(key, url);
        setDataUrl(url);
        setStatus("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [file, page]);

  if (!file || page == null || page < 1) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-400/50 bg-brand-800 px-4 py-8 text-center">
        <FileQuestion className="h-8 w-8 text-brand-200" aria-hidden />
        <p className="text-sm font-semibold text-white">No page image for this question</p>
        <p className="max-w-xs text-xs leading-relaxed text-brand-100">
          Spreadsheet and Word imports have no scan to compare. Check the text on the right against
          your paper.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-xl border border-brand-400/40 bg-brand-800">
      <div className="flex items-center justify-between gap-2 border-b border-brand-400/30 px-3 py-2">
        <p className="text-xs font-semibold text-brand-100">
          Source page <span className="tabular-nums text-white">{page}</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100))}
            className="tap grid h-7 w-7 place-items-center rounded-md text-brand-100 hover:bg-brand-700 hover:text-white"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100))}
            className="tap grid h-7 w-7 place-items-center rounded-md text-brand-100 hover:bg-brand-700 hover:text-white"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!dataUrl}
            className="tap grid h-7 w-7 place-items-center rounded-md text-brand-100 hover:bg-brand-700 hover:text-white disabled:opacity-40"
            aria-label="Open page larger"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[280px] flex-1 overflow-auto bg-brand-900/40">
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center text-brand-100">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading page" />
          </div>
        )}
        {status === "error" && (
          <p className="p-4 text-center text-xs font-semibold text-white">
            This page could not be shown. You can still edit the text on the right.
          </p>
        )}
        {dataUrl && (
          <img
            src={dataUrl}
            alt={`Original exam page ${page} for ${questionLabel}`}
            className="mx-auto block origin-top"
            style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden border-brand-400/40 bg-brand-800 p-0 text-white sm:rounded-2xl">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-base">Page {page}</DialogTitle>
            <DialogDescription className="text-brand-100">
              {questionLabel} — compare this scan to the draft, then close and fix any typos.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[78vh] overflow-auto px-4 pb-4">
            {dataUrl && (
              <img
                src={dataUrl}
                alt={`Original exam page ${page} for ${questionLabel}`}
                className="w-full rounded-lg bg-white"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
