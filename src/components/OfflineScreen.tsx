import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";

declare global {
  interface Window {
    startOfflineTetris?: (root: HTMLElement) => () => void;
  }
}

const PROBE_URL = "/manifest.webmanifest";
const POLL_MS = 5000;

/** Same-origin reachability — not navigator.onLine (false positives on Windows/VPN). */
async function probeOnline(): Promise<boolean> {
  try {
    const head = await fetch(PROBE_URL, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
  } catch {
    /* fall through to GET */
  }
  try {
    const get = await fetch(PROBE_URL, { method: "GET", cache: "no-store" });
    return get.ok;
  } catch {
    return false;
  }
}

function OfflineTetris() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let destroy: (() => void) | undefined;
    let cancelled = false;
    let scriptEl: HTMLScriptElement | null = null;

    async function boot() {
      if (!window.startOfflineTetris) {
        await new Promise<void>((resolve, reject) => {
          scriptEl = document.createElement("script");
          scriptEl.src = `/offline-tetris.js?v=4`;
          scriptEl.async = true;
          scriptEl.onload = () => resolve();
          scriptEl.onerror = () => reject(new Error("Failed to load offline Tetris"));
          document.head.appendChild(scriptEl);
        });
      }
      if (cancelled || !rootRef.current || !window.startOfflineTetris) {
        if (!cancelled && !window.startOfflineTetris) {
          setLoadError("Game unavailable");
        }
        return;
      }
      destroy = window.startOfflineTetris(rootRef.current);
      setLoadError(null);
    }

    void boot().catch(() => {
      if (!cancelled) setLoadError("Game unavailable");
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="mt-5 w-full rounded-2xl bg-white/[0.06] p-3.5 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
      aria-label="Offline Tetris"
    >
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-brand-100">
        Meanwhile · Tetris
      </p>
      {loadError ? (
        <p className="py-8 text-center text-sm text-brand-100/80">{loadError}</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-brand-100">
            <span>
              Score <strong data-score>0</strong>
            </span>
            <button
              type="button"
              data-restart
              className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white"
            >
              New game
            </button>
          </div>
          <div className="relative mx-auto block w-fit overflow-hidden rounded-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
            <canvas
              data-board
              width={180}
              height={360}
              className="block h-[360px] w-[180px] bg-[#040459] touch-none"
              aria-label="Tetris board"
            />
            <div
              data-overlay
              hidden
              className="absolute inset-0 grid place-items-center bg-[#040459]/70 p-4 text-center text-xs font-bold text-white"
            />
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            <button
              type="button"
              data-left
              aria-label="Move left"
              className="min-h-10 select-none rounded-xl bg-white/10 text-base font-bold text-white active:bg-white/20"
            >
              ←
            </button>
            <button
              type="button"
              data-rotate
              aria-label="Rotate"
              className="min-h-10 select-none rounded-xl bg-white/10 text-base font-bold text-white active:bg-white/20"
            >
              ↻
            </button>
            <button
              type="button"
              data-right
              aria-label="Move right"
              className="min-h-10 select-none rounded-xl bg-white/10 text-base font-bold text-white active:bg-white/20"
            >
              →
            </button>
            <button
              type="button"
              data-soft
              aria-label="Soft drop"
              className="min-h-10 select-none rounded-xl bg-white/10 text-base font-bold text-white active:bg-white/20"
            >
              ↓
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-brand-100/75">
            Arrow keys / WASD · Space rotates
          </p>
        </>
      )}
    </section>
  );
}

/** Shared offline messaging used by the in-app gate and mirrored in `/offline.html`. */
export function OfflineScreenContent({ onRetry }: { onRetry?: () => void }) {
  return (
    <main className="relative z-10 mx-auto flex max-h-[100dvh] w-full max-w-sm flex-col items-center overflow-y-auto px-6 py-8 text-center">
      <img
        src="/pwa-192x192.png"
        alt=""
        width={56}
        height={56}
        className="mb-3 h-14 w-14 rounded-[14px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      />
      <span className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-brand-100 ring-1 ring-white/15">
        <WifiOff className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-200">BeyondSAT</p>
      <h1 className="mt-1.5 text-xl font-black tracking-tight text-white">
        No internet connection
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-100/90">
        You're offline. Reconnect when you can — or clear a few lines while you wait.
      </p>
      {onRetry && (
        <button
          type="button"
          data-retry
          onClick={onRetry}
          className="tap mt-4 min-w-[9rem] rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-600 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
        >
          Try again
        </button>
      )}
      <OfflineTetris />
    </main>
  );
}

/**
 * Full-screen gate only when a same-origin probe fails.
 * Never trust navigator.onLine alone — it false-positives on Windows/VPN.
 */
export function OfflineGate() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let live = true;

    async function applyProbe(showIfDown: boolean) {
      const ok = await probeOnline();
      if (!live) return;
      if (ok) setOffline(false);
      else if (showIfDown) setOffline(true);
    }

    const goOffline = () => {
      void applyProbe(true);
    };
    const goOnline = () => {
      void applyProbe(false);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    /* Mount: only probe if the OS already reports offline — never block a
       healthy session from a bad navigator.onLine reading alone. */
    if (!navigator.onLine) void applyProbe(true);

    return () => {
      live = false;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  /* While the gate is up, poll so sticky false-offline recovers without reload. */
  useEffect(() => {
    if (!offline) return;
    let live = true;
    const id = setInterval(() => {
      void (async () => {
        const ok = await probeOnline();
        if (live && ok) setOffline(false);
      })();
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [offline]);

  async function onRetry() {
    const ok = await probeOnline();
    if (ok) {
      setOffline(false);
      return;
    }
    window.location.reload();
  }

  if (!offline) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="No internet connection"
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-brand-600 sm:items-center"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background: "var(--grad-brand)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-brand-400/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-brand-800/50 blur-3xl"
        aria-hidden
      />
      <OfflineScreenContent onRetry={() => void onRetry()} />
    </div>
  );
}
