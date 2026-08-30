const PREF_KEY = "vocab_push_enabled";
const LAST_NOTIFY_KEY = "vocab_push_last_date";

export function isPushEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPushEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") {
    setPushEnabled(true);
    return true;
  }
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  const ok = result === "granted";
  if (ok) setPushEnabled(true);
  return ok;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fire at most one browser notification per calendar day when cards are due. */
export function maybeNotifyDue(dueCount: number, deckTitle = "Vocab"): void {
  if (dueCount <= 0 || !isPushEnabled()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  try {
    const last = localStorage.getItem(LAST_NOTIFY_KEY);
    const today = todayKey();
    if (last === today) return;
    localStorage.setItem(LAST_NOTIFY_KEY, today);
  } catch {
    return;
  }

  const n = dueCount;
  const body =
    n === 1
      ? `1 card is due in ${deckTitle}. Tap to review.`
      : `${n} cards are due in ${deckTitle}. Tap to review.`;

  try {
    new Notification("Beyond SAT · Vocab review", {
      body,
      tag: "vocab-due",
    });
  } catch {
    /* Safari / blocked */
  }
}

const POLL_MS = 30 * 60 * 1000;

/** Poll due count while the app is open; fires maybeNotifyDue when count > 0. */
export function startVocabReminderPoll(
  getDueCount: () => Promise<number>,
  deckTitle?: string,
): () => void {
  let cancelled = false;

  void (async () => {
    try {
      const n = await getDueCount();
      if (!cancelled && n > 0) maybeNotifyDue(n, deckTitle);
    } catch {
      /* ignore */
    }
  })();

  const id = window.setInterval(() => {
    void (async () => {
      try {
        const n = await getDueCount();
        if (!cancelled && n > 0) maybeNotifyDue(n, deckTitle);
      } catch {
        /* ignore */
      }
    })();
  }, POLL_MS);

  return () => {
    cancelled = true;
    window.clearInterval(id);
  };
}
