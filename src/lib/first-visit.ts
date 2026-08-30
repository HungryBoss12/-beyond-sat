const prefix = "beyondsat-tip-seen:";

export function hasSeenTip(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(`${prefix}${key}`) === "1";
  } catch {
    return true;
  }
}

export function markTipSeen(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${prefix}${key}`, "1");
  } catch {
    /* ignore */
  }
}
