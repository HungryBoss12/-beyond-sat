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
 * Saved-account vault.
 *
 * `localStorage` (`beyondsat.saved-accounts`) holds display metadata ONLY
 * (`userId`, `username`, `displayName`, `email`) — never `accessToken` or
 * `refreshToken`.
 *  - `sessionStorage` keeps per-tab `accessToken` (`beyondsat.saved-access`)
 *    and `refreshToken` (`beyondsat.saved-refresh`).
 *  - When "Keep me signed in" is checked, `beyondsat.kept-refresh` stores the
 *    refresh token so `Continue as` can mint a fresh session after browser
 *    restarts via `refreshSession`. Unchecking deletes `beyondsat.kept-refresh`.
 *  - Legacy vault rows carrying `accessToken` or `refreshToken` in
 *    `localStorage` are scrubbed on read/write.
 */

const KEY = "beyondsat.saved-accounts";
const ACCESS_KEY = "beyondsat.saved-access";
const REFRESH_KEY = "beyondsat.saved-refresh";
const MAX_ACCOUNTS = 5;

export type SavedAccount = {
  userId: string;
  username: string | null;
  displayName: string;
  email: string | null;
  /** In-memory / sessionStorage only — never written to localStorage. */
  accessToken?: string;
  /** In-memory / sessionStorage only — never written to localStorage. */
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
    const legacy = parsed.some((v) => {
      if (!v || typeof v !== "object") return false;
      const rec = v as Record<string, unknown>;
      return "refreshToken" in rec || "accessToken" in rec;
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
  return typeof row.userId === "string" && typeof row.displayName === "string";
}

function writeVault(accounts: SavedAccount[]) {
  /* Strip both access and refresh tokens so localStorage holds metadata only. */
  const safe = accounts
    .slice(0, MAX_ACCOUNTS)
    .map(({ accessToken: _dropAccess, refreshToken: _dropRefresh, ...rest }) => rest);
  localStorage.setItem(KEY, JSON.stringify(safe));
}

type TokenMap = Record<string, string>;

function readSessionTokenMap(storageKey: string): TokenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: TokenMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === "string" && typeof v === "string" && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeSessionToken(storageKey: string, userId: string, token: string): void {
  if (typeof window === "undefined" || !token) return;
  const map = readSessionTokenMap(storageKey);
  map[userId] = token;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* quota/private mode */
  }
}

function dropSessionToken(storageKey: string, userId: string): void {
  if (typeof window === "undefined") return;
  const map = readSessionTokenMap(storageKey);
  if (!(userId in map)) return;
  delete map[userId];
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Refresh token still stored by supabase-js for a kept session. */
function refreshFromSupabaseStorage(): TokenMap {
  if (typeof window === "undefined" || !isKeepSignedIn()) return {};
  const out: TokenMap = {};
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

function readRefreshTokens(): TokenMap {
  const session = readSessionTokenMap(REFRESH_KEY);
  if (!isKeepSignedIn()) return session;
  return { ...refreshFromSupabaseStorage(), ...readKeptRefresh(), ...session };
}

function saveSessionTokens(userId: string, accessToken?: string, refreshToken?: string): void {
  if (accessToken) writeSessionToken(ACCESS_KEY, userId, accessToken);
  if (refreshToken) {
    writeSessionToken(REFRESH_KEY, userId, refreshToken);
    writeKeptRefresh(userId, refreshToken);
  }
}

function dropAccountTokens(userId: string): void {
  dropSessionToken(ACCESS_KEY, userId);
  dropSessionToken(REFRESH_KEY, userId);
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
  saveSessionTokens(next.userId, next.accessToken, next.refreshToken);
}

export async function switchToAccount(userId: string): Promise<void> {
  const account = readVault().find((a) => a.userId === userId);
  if (!account) throw new Error("That account is no longer saved on this device.");
  const refreshToken = readRefreshTokens()[userId];
  const accessToken = readSessionTokenMap(ACCESS_KEY)[userId];

  if (refreshToken && accessToken) {
    const { error, data } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      removeSavedAccount(userId);
      throw new Error("That saved session expired. Sign in again.");
    }
  } else if (refreshToken) {
    const { error, data } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      removeSavedAccount(userId);
      throw new Error("That saved session expired. Sign in again.");
    }
  } else if (accessToken) {
    const ttl = accessTokenTtlSeconds(accessToken);
    if (ttl <= 60) {
      removeSavedAccount(userId);
      throw new Error("That saved session expired. Sign in again.");
    }
    const { error, data } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: "session-storage-only",
    });
    if (error || !data.session) {
      removeSavedAccount(userId);
      throw new Error("That saved session expired. Sign in again.");
    }
  } else {
    removeSavedAccount(userId);
    throw new Error("That saved session expired. Sign in again.");
  }
  await rememberCurrentSession();
}

export function removeSavedAccount(userId: string): void {
  writeVault(readVault().filter((a) => a.userId !== userId));
  dropAccountTokens(userId);
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
      sessionStorage.removeItem(ACCESS_KEY);
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
