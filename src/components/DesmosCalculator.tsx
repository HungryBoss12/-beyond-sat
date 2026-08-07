import { useEffect, useRef, useState } from "react";
import { Calculator, X, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

let scriptPromise: Promise<void> | null = null;

function loadDesmos(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as any;
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
  const { data } = await supabase.rpc("get_desmos_api_key" as any);
  const v = data as unknown as string | null | undefined;
  return v && v.trim() ? v.trim() : null;
}

/**
 * Floating Desmos calculator button + panel.
 * Only renders when an admin has saved a Desmos API key.
 */
export function DesmosCalculator() {
  const [key, setKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [ready, setReady] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<any>(null);

  useEffect(() => {
    fetchDesmosKey().then(setKey);
  }, []);

  useEffect(() => {
    if (!open || !key || !mountRef.current) return;
    let cancelled = false;
    loadDesmos(key)
      .then(() => {
        if (cancelled || !mountRef.current) return;
        const w = window as any;
        if (!calcRef.current) {
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
  }, [open, key]);

  useEffect(() => {
    return () => {
      if (calcRef.current) {
        try {
          calcRef.current.destroy();
        } catch {}
        calcRef.current = null;
      }
    };
  }, []);

  if (!key) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          className="btn-test fixed bottom-24 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-test-accent px-4 py-2.5 text-sm font-bold text-white shadow-float hover:bg-test-accent-deep"
          title="Open Desmos calculator"
        >
          <Calculator className="h-4 w-4" /> Calculator
        </button>
      )}
      {open && (
        <div
          className={
            /* Only the chrome is ours — the graph area is a Desmos embed that
               paints its own surface, so it isn't recolored here. Desmos renders
               on white, which is now what the panel around it is too. */
            "pop-in fixed z-40 flex flex-col overflow-hidden rounded-xl border border-test-line bg-white shadow-float " +
            (minimized
              ? "bottom-24 right-6 w-72 h-12"
              : "bottom-6 right-6 w-[min(92vw,720px)] h-[min(80vh,640px)]")
          }
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-test-line bg-test-chrome px-3">
            <div className="flex items-center gap-2 text-sm font-bold text-test-ink">
              <Calculator className="h-4 w-4 text-test-accent" /> Desmos Calculator
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized((v) => !v)}
                className="tap grid h-8 w-8 place-items-center rounded-md text-test-muted hover:bg-test-tint hover:text-test-accent"
                title={minimized ? "Expand" : "Minimize"}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="tap grid h-8 w-8 place-items-center rounded-md text-test-muted hover:bg-test-tint hover:text-test-accent"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {!minimized && (
            <div className="relative flex-1">
              {!ready && (
                <div className="absolute inset-0 grid place-items-center bg-white text-sm font-semibold text-test-muted">
                  Loading calculator…
                </div>
              )}
              <div ref={mountRef} className="absolute inset-0" />
            </div>
          )}
        </div>
      )}
    </>
  );
}
