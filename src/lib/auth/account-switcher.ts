import { supabase } from "@/integrations/supabase/client";
import { displayAccountEmail, isSyntheticAccountEmail } from "./login-email";
import {
  clearKeepSignedIn,
  dropKeptRefresh,
  isKeepSignedIn,
  readKeptRefresh,
  writeKeptRefresh,
} from "./session-policy";

/**
 * Saved-account vault (H4).
 *
 * `localStorage` previously held every account's LONG-LIVED refresh token —
 * a weekslong credential readable by any script on the page, forever. Now:
 *
 *  - localStorage keeps display info and the last access token. A checked
 *    "Keep me signed in" also stores that account's refresh token.
 *  - sessionStorage keeps refresh tokens for this tab.
 *  - When "Keep me signed in" is checked, the same refresh tokens are also
 *    kept in localStorage so Continue as still works after the browser closes.
 *    Unchecking the box deletes that copy. The tab copy is unchanged.
 *  - Legacy vault rows that still contain a `refreshToken` are scrubbed from
 *    localStorage the first time this module touches it.
 */

const KEY = "beyondsat.saved-accounts";
const REFRESH_KEY = "beyondsat.saved-refresh";
const MAX_ACCOUNTS = 5;

export type SavedAccount = {
  userId: string;
  username: string | null;
  displayName: string;
  email: string | null;
  accessToken: string;
  /** In-memory only — never written to localStorage. */
  refreshToken?: string;
};

function readVault(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const accounts = parsed.filter(isSavedAccount);
    // Legacy rows may still carry a refresh token in localStorage — rewrite
    // the vault without them once so the plaintext secret is really gone.
    const legacy = parsed.some((v) => {
      if (!v || typeof v !== "object") return false;
      return "refreshToken" in (v as Record<string, unknown>);
    });
    if (legacy) {
      writeVault(accounts);
    }
    return accounts;
  } catch {
    return [];
  }
}

function isSavedAccount(value: unknown): value is SavedAccount {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.userId === "string" &&
    typeof row.displayName === "string" &&
    typeof row.accessToken === "string"
  );
}

function writeVault(accounts: SavedAccount[]) {
  /* Strip refresh tokens defensively: they must never touch localStorage. */
  const safe = accounts.slice(0, MAX_ACCOUNTS).map(({ refreshToken: _drop, ...rest }) => rest);
  localStorage.setItem(KEY, JSON.stringify(safe));
}

type RefreshMap = Record<string, string>;

function readSessionRefresh(): RefreshMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(REFRESH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: RefreshMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === "string" && typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Refresh token still stored by supabase-js for a kept session. */
function refreshFromSupabaseStorage(): RefreshMap {
  if (typeof window === "undefined" || !isKeepSignedIn()) return {};
  const out: RefreshMap = {};
  try {
    for (const key of Object.keys(localStorage)) {
      if (!/^sb-.+-auth-token(?:\.\d+)?$/.test(key)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as {
        refresh_token?: unknown;
        user?: { id?: unknown };
        currentSession?: { refresh_token?: unknown; user?: { id?: unknown } };
      } | null;
      const session = parsed?.currentSession ?? parsed;
      const userId = session?.user?.id;
      const token = session?.refresh_token;
      if (typeof userId === "string" && typeof token === "string" && token.length > 0) {
        out[userId] = token;
      }
    }
  } catch {
    /* ignore a corrupt auth blob */
  }
  return out;
}

function readRefreshTokens(): RefreshMap {
  const session = readSessionRefresh();
  if (!isKeepSignedIn()) return session;
  return { ...refreshFromSupabaseStorage(), ...readKeptRefresh(), ...session };
}

function saveRefreshToken(userId: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  const map = readSessionRefresh();
  map[userId] = refreshToken;
  try {
    sessionStorage.setItem(REFRESH_KEY, JSON.stringify(map));
  } catch {
    /* quota/private mode: switching still works from the access token */
  }
  writeKeptRefresh(userId, refreshToken);
}

function dropRefreshToken(userId: string): void {
  if (typeof window === "undefined") return;
  const map = readRefreshTokens();
  if (userId in map) {
    delete map[userId];
    try {
      sessionStorage.setItem(REFRESH_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }
  dropKeptRefresh(userId);
}

/** Seconds until the access token expires (negative if already expired). */
function accessTokenTtlSeconds(token: string): number {
  try {
    const part = token.split(".")[1];
    if (!part) return -1;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: unknown;
    };
    return typeof payload.exp === "number" ? payload.exp - Date.now() / 1000 : -1;
  } catch {
    return -1;
  }
}

export function listSavedAccounts(): SavedAccount[] {
  return readVault();
}

async function accountFromSession(): Promise<SavedAccount | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const user = session.user;
  const { data: prof } = await supabase
    .from("profiles")
    .select("username,full_name,first_name,email")
    .eq("id", user.id)
    .maybeSingle();
  const email = displayAccountEmail(prof?.email ?? user.email);
  const displayName =
    prof?.full_name ||
    prof?.first_name ||
    prof?.username ||
    email ||
    (isSyntheticAccountEmail(user.email) ? "Student" : user.email?.split("@")[0]) ||
    "Student";
  return {
    userId: user.id,
    username: prof?.username ?? null,
    displayName,
    email,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
}

export async function rememberCurrentSession(): Promise<void> {
  const next = await accountFromSession();
  if (!next) return;
  const rest = readVault().filter((a) => a.userId !== next.userId);
  writeVault([next, ...rest]);
  if (next.refreshToken) saveRefreshToken(next.userId, next.refreshToken);
}

export async function switchToAccount(userId: string): Promise<void> {
  const account = readVault().find((a) => a.userId === userId);
  if (!account) throw new Error("That account is no longer saved on this device.");
  const refreshToken = readRefreshTokens()[userId];

  if (refreshToken) {
    /* Same browser session: supabase-js refreshes an expired access token
       against this refresh token transparently inside setSession. */
    const { error, data } = await supabase.auth.setSession({
      access_token: account.accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      removeSavedAccount(userId);
      throw new Error("That saved session expired. Sign in again.");
    }
  } else {
    /* New tab/browser: no refresh token available. Only a still-live access
       token can restore the session — and setSession refuses an empty refresh
       token, so a still-valid token goes in with a marker the server never
       sees; auto-refresh will fail gracefully near expiry instead. */
    const ttl = accessTokenTtlSeconds(account.accessToken);
    if (ttl <= 60) {
      removeSavedAccount(userId);
      throw new Error("That saved session expired. Sign in again.");
    }
    const { error, data } = await supabase.auth.setSession({
      access_token: account.accessToken,
      refresh_token: "session-storage-only",
    });
    if (error || !data.session) {
      removeSavedAccount(userId);
      throw new Error("That saved session expired. Sign in again.");
    }
  }
  await rememberCurrentSession();
}

export function removeSavedAccount(userId: string): void {
  writeVault(readVault().filter((a) => a.userId !== userId));
  dropRefreshToken(userId);
}

export async function signOutCurrent(): Promise<SavedAccount | null> {
  const { data } = await supabase.auth.getUser();
  const currentId = data.user?.id;
  await supabase.auth.signOut({ scope: "global" });
  clearKeepSignedIn();
  if (currentId) removeSavedAccount(currentId);
  const next = readVault()[0] ?? null;
  if (next) {
    try {
      await switchToAccount(next.userId);
      return next;
    } catch {
      return null;
    }
  }
  return null;
}

export async function signOutAll(): Promise<void> {
  await supabase.auth.signOut({ scope: "global" });
  clearKeepSignedIn();
  writeVault([]);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  }
}

export async function prepareAddAccount(): Promise<void> {
  await rememberCurrentSession();
  await supabase.auth.signOut({ scope: "local" });
}

export function subscribeAccountRefresh(): () => void {
  if (isKeepSignedIn()) void rememberCurrentSession();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (!session) return;
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      void rememberCurrentSession();
    }
  });
  return () => data.subscription.unsubscribe();
}
