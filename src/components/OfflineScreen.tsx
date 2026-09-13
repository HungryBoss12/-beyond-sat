import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

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
      <h1 className="mt-1.5 text-xl font-black tracking-tight text-white">No internet connection</h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-100/90">
        You're offline. Reconnect when you can, then try again.
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
