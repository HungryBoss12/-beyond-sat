import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FigureBox } from "@/lib/import/crop-figure";
import { clampBox, cropPageToBlob } from "@/lib/import/crop-figure";

type NormBox = Pick<FigureBox, "x" | "y" | "w" | "h">;

function defaultBox(): NormBox {
  return { x: 0.1, y: 0.12, w: 0.8, h: 0.35 };
}

/**
 * Manual crop dialog: drag a rectangle on the source PDF page, preview, then attach.
 */
export function FigureCropDialog({
  open,
  onOpenChange,
  file,
  page,
  questionLabel,
  attaching,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  page: number | null | undefined;
  questionLabel: string;
  attaching?: boolean;
  onAttach: (box: NormBox) => void | Promise<void>;
}) {
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [box, setBox] = useState<NormBox>(defaultBox);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origin: NormBox;
  } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!open) return;
    setBox(defaultBox());
    setPreviewUrl(null);
  }, [open, page]);

  useEffect(() => {
    if (!open || !file || page == null || page < 1) {
      setPageUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void import("@/lib/import/pdf")
      .then(({ renderPdfPage }) => renderPdfPage(file, page, { scale: 2, quality: 0.92 }))
      .then((url) => {
        if (!cancelled) setPageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPageUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, file, page]);

  const pointerToNorm = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  function onPointerDown(e: React.PointerEvent, mode: "move" | "resize") {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...box },
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const img = imgRef.current;
    if (!drag || !img) return;
    const rect = img.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const o = drag.origin;
    if (drag.mode === "move") {
      setBox(
        clampBox({
          x: o.x + dx,
          y: o.y + dy,
          w: o.w,
          h: o.h,
        }),
      );
    } else {
      setBox(
        clampBox({
          x: o.x,
          y: o.y,
          w: Math.max(0.04, o.w + dx),
          h: Math.max(0.04, o.h + dy),
        }),
      );
    }
    setPreviewUrl(null);
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  async function previewCrop() {
    if (!pageUrl) return;
    setPreviewing(true);
    try {
      const blob = await cropPageToBlob(pageUrl, box);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } finally {
      setPreviewing(false);
    }
  }

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden border-brand-400/40 bg-brand-800 p-0 text-white sm:rounded-2xl">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-base">Crop figure manually</DialogTitle>
          <DialogDescription className="text-brand-100">
            {questionLabel} — drag the box on page {page}, preview the crop, then attach it.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-auto px-4 pb-4">
          <div className="relative overflow-hidden rounded-lg border border-brand-400/40 bg-brand-900/50">
            {loading && (
              <div className="grid min-h-[240px] place-items-center text-brand-100">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {!loading && pageUrl && (
              <div
                className="relative touch-none select-none"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <img
                  ref={imgRef}
                  src={pageUrl}
                  alt={`Source page ${page}`}
                  className="block w-full"
                  draggable={false}
                />
                <div
                  className="absolute border-2 border-brand-200 bg-brand-200/15"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.w * 100}%`,
                    height: `${box.h * 100}%`,
                  }}
                  onPointerDown={(e) => onPointerDown(e, "move")}
                >
                  <div
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-sm bg-brand-200"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onPointerDown(e, "resize");
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {previewUrl && (
            <div className="overflow-hidden rounded-lg border border-brand-400/40 bg-white p-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-900">
                Crop preview
              </p>
              <img src={previewUrl} alt="Crop preview" className="max-h-48 w-full object-contain" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!pageUrl || previewing}
              onClick={() => void previewCrop()}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Preview crop
            </button>
            <button
              type="button"
              disabled={!pageUrl || attaching}
              onClick={() => void onAttach(box)}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {attaching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crop className="h-3.5 w-3.5" />
              )}
              Attach crop
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
