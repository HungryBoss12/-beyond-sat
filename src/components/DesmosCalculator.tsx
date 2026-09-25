import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Calculator, X, Minus, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

let scriptPromise: Promise<void> | null = null;

interface DesmosCalculatorInstance {
  destroy(): void;
  resize?: () => void;
}

interface DesmosGlobal {
  GraphingCalculator: (el: HTMLElement, opts: Record<string, boolean>) => DesmosCalculatorInstance;
}

type DesmosWindow = Window & { Desmos?: DesmosGlobal };

type Pos = { x: number; y: number };

function loadDesmos(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as DesmosWindow;
  if (w.Desmos?.GraphingCalculator) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Desmos"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function fetchDesmosKey(): Promise<string | null> {
  const { data } = await supabase.rpc("get_desmos_api_key");
  const v = data as string | null | undefined;
  return v && v.trim() ? v.trim() : null;
}

function clampPos(x: number, y: number, w: number, h: number): Pos {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - w - margin);
  const maxY = Math.max(margin, window.innerHeight - h - margin);
  return {
    x: Math.min(maxX, Math.max(margin, x)),
    y: Math.min(maxY, Math.max(margin, y)),
  };
}

function defaultPos(minimized: boolean): Pos {
  const w = minimized ? 288 : Math.min(window.innerWidth * 0.92, 720);
  const h = minimized ? 48 : Math.min(window.innerHeight * 0.8, 640);
  return clampPos(window.innerWidth - w - 24, window.innerHeight - h - (minimized ? 96 : 24), w, h);
}

/**
 * Floating Desmos calculator for Math questions.
 * Uses the Desmos API when an admin key is set; otherwise embeds the public
 * calculator in an iframe. The embed stays mounted across minimize/close so
 * expressions are not lost; the chrome is draggable in both sizes.
 */
export function DesmosCalculator() {
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculatorInstance | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    fetchDesmosKey()
      .then(setKey)
      .catch(() => setKey(null));
  }, []);

  // Init API calculator once (not on every open/minimize)
  useEffect(() => {
    if (!everOpened || !key || !mountRef.current || calcRef.current) return;
    let cancelled = false;
    loadDesmos(key)
      .then(() => {
        if (cancelled || !mountRef.current || calcRef.current) return;
        const w = window as DesmosWindow;
        if (w.Desmos) {
          calcRef.current = w.Desmos.GraphingCalculator(mountRef.current, {
            expressions: true,
            keypad: true,
            settingsMenu: true,
            border: false,
          });
        }
        setReady(true);
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [everOpened, key]);

  // Resize API calc after expand so the graph fills the panel again
  useEffect(() => {
    if (!open || minimized || !calcRef.current?.resize) return;
    const t = window.setTimeout(() => calcRef.current?.resize?.(), 50);
    return () => clearTimeout(t);
  }, [open, minimized]);

  useEffect(() => {
    return () => {
      if (calcRef.current) {
        try {
          calcRef.current.destroy();
        } catch {
          void 0;
        }
        calcRef.current = null;
      }
    };
  }, []);

  function openPanel() {
    setEverOpened(true);
    setOpen(true);
    setMinimized(false);
    setPos((prev) => prev ?? defaultPos(false));
  }

  function onTitlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    e.preventDefault();
    const panel = e.currentTarget.parentElement;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const current = pos ?? { x: rect.left, y: rect.top };
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onTitlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const panel = e.currentTarget.parentElement;
    const w = panel?.offsetWidth ?? 288;
    const h = panel?.offsetHeight ?? 48;
    const next = clampPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      w,
      h,
    );
    setPos(next);
  }

  function onTitlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        void 0;
      }
    }
  }

  if (key === undefined) return null;

  const useIframe = !key;
  const panelW = minimized ? "w-72" : "w-[min(92vw,720px)]";
  const panelH = minimized ? "h-12" : "h-[min(80vh,640px)]";
  const placed = pos ?? (typeof window !== "undefined" ? defaultPos(minimized) : { x: 0, y: 0 });

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          className="btn-test fixed bottom-24 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-test-accent px-4 py-2.5 text-sm font-bold text-white shadow-float hover:bg-test-accent-deep"
          title="Open Desmos calculator"
        >
          <Calculator className="h-4 w-4" /> Calculator
        </button>
      )}

      {everOpened && (
        <div
          className={
            "fixed z-40 flex flex-col overflow-hidden rounded-xl border border-test-line bg-white shadow-float " +
            panelW +
            " " +
            panelH +
            (open ? "" : " hidden")
          }
          style={{ left: placed.x, top: placed.y, right: "auto", bottom: "auto" }}
        >
          <div
            className="flex h-11 shrink-0 cursor-grab items-center justify-between border-b border-test-line bg-test-chrome px-3 active:cursor-grabbing"
            onPointerDown={onTitlePointerDown}
            onPointerMove={onTitlePointerMove}
            onPointerUp={onTitlePointerUp}
            onPointerCancel={onTitlePointerUp}
          >
            <div className="flex items-center gap-2 text-sm font-bold text-test-ink">
              <Calculator className="h-4 w-4 text-test-accent" /> Desmos Calculator
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMinimized((v) => {
                    const next = !v;
                    setPos((p) => {
                      const base = p ?? defaultPos(v);
                      return clampPos(
                        base.x,
                        base.y,
                        next ? 288 : Math.min(window.innerWidth * 0.92, 720),
                        next ? 48 : Math.min(window.innerHeight * 0.8, 640),
                      );
                    });
                    return next;
                  });
                }}
                className="tap grid h-8 w-8 place-items-center rounded-md text-test-muted hover:bg-test-tint hover:text-test-accent"
                title={minimized ? "Expand" : "Minimize"}
              >
                {minimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tap grid h-8 w-8 place-items-center rounded-md text-test-muted hover:bg-test-tint hover:text-test-accent"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/*
            Calculator stays mounted at full size; the panel clips to the title bar
            when minimized so Desmos never unmounts or resizes to 0×0.
          */}
          <div
            className="relative w-full shrink-0"
            style={{ height: "calc(min(80vh, 640px) - 2.75rem)" }}
            aria-hidden={minimized}
          >
            {useIframe ? (
              <iframe
                title="Desmos graphing calculator"
                src="https://www.desmos.com/calculator"
                className="absolute inset-0 h-full w-full border-0"
                allow="clipboard-write"
              />
            ) : (
              <>
                {!ready && (
                  <div className="absolute inset-0 grid place-items-center bg-white text-sm font-semibold text-test-muted">
                    Loading calculator…
                  </div>
                )}
                <div ref={mountRef} className="absolute inset-0" />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
