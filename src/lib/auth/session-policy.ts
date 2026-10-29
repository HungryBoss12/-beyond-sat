/**
 * Who stays signed in. Kept free of the Supabase client so the client can call
 * `dropUnkeptSession` before it reads the stored session.
 */

/** Must match `bs_admin_session_fresh()` in the database. */
export const ADMIN_SESSION_HOURS = 12;

const KEEP_KEY = "beyondsat.keep-signed-in";
const ALIVE_COOKIE = "bs_alive";
const VAULT_KEY = "beyondsat.saved-accounts";
/** Refresh tokens live here only while "Keep me signed in" is on. */
const KEPT_REFRESH_KEY = "beyondsat.kept-refresh";

export function isKeepSignedIn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(KEEP_KEY) !== "0";
  } catch {
    return true;
  }
}

function readKeptRefreshMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEPT_REFRESH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [userId, token] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof token === "string" && token.length > 0) out[userId] = token;
    }
    return out;
  } catch {
    return {};
  }
}

export function readKeptRefresh(): Record<string, string> {
  if (!isKeepSignedIn()) return {};
  return readKeptRefreshMap();
}

export function writeKeptRefresh(userId: string, refreshToken: string): void {
  if (typeof window === "undefined" || !isKeepSignedIn() || !refreshToken) return;
  try {
    const map = readKeptRefresh();
    map[userId] = refreshToken;
    localStorage.setItem(KEPT_REFRESH_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function dropKeptRefresh(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!userId) {
      localStorage.removeItem(KEPT_REFRESH_KEY);
      return;
    }
    const map = readKeptRefreshMap();
    if (!(userId in map)) return;
    delete map[userId];
    localStorage.setItem(KEPT_REFRESH_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

function aliveCookieSet(): boolean {
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${ALIVE_COOKIE}=`));
}

/** Called on sign-in. Without "keep", the session ends when the browser closes. */
export function setKeepSignedIn(keep: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEEP_KEY, keep ? "1" : "0");
    if (!keep) localStorage.removeItem(KEPT_REFRESH_KEY);
  } catch {
    /* private mode */
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ALIVE_COOKIE}=1; path=/; SameSite=Lax${secure}`;
}

export function clearKeepSignedIn(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEEP_KEY);
    localStorage.removeItem(KEPT_REFRESH_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * A session-only cookie marks "this browser is still open". When the user
 * chose not to stay signed in and the cookie is gone, the stored session and
 * its saved-account entry are removed before anything can use them.
 */
export function dropUnkeptSession(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(KEEP_KEY) !== "0" || aliveCookieSet()) return;
    localStorage.removeItem(KEPT_REFRESH_KEY);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (!/^sb-.+-auth-token(?:\.\d+)?$/.test(key)) continue;
      const userId = (JSON.parse(localStorage.getItem(key) ?? "null") as { user?: { id?: string } } | null)
        ?.user?.id;
      localStorage.removeItem(key);
      if (userId) {
        const vault = JSON.parse(localStorage.getItem(VAULT_KEY) ?? "[]") as { userId?: string }[];
        if (Array.isArray(vault)) {
          localStorage.setItem(VAULT_KEY, JSON.stringify(vault.filter((a) => a?.userId !== userId)));
        }
      }
    }
    localStorage.removeItem(KEEP_KEY);
  } catch {
    /* unreadable storage: leave it to the normal sign-in flow */
  }
}

/** When the user last typed a password (or used a link), in epoch seconds. */
export function signedInAt(accessToken: string): number | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as {
      amr?: { timestamp?: unknown }[];
    };
    const stamps = (payload.amr ?? [])
      .map((entry) => entry?.timestamp)
      .filter((value): value is number => typeof value === "number");
    return stamps.length ? Math.max(...stamps) : null;
  } catch {
    return null;
  }
}

export function adminSessionExpired(accessToken: string): boolean {
  const at = signedInAt(accessToken);
  return at != null && Date.now() / 1000 - at > ADMIN_SESSION_HOURS * 3600;
}
