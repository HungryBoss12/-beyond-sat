import { supabase } from "@/integrations/supabase/client";
import { displayAccountEmail, isSyntheticAccountEmail } from "./login-email";

const KEY = "beyondsat.saved-accounts";
const MAX_ACCOUNTS = 5;

export type SavedAccount = {
  userId: string;
  username: string | null;
  displayName: string;
  email: string | null;
  accessToken: string;
  refreshToken: string;
};

function readVault(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedAccount);
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
    typeof row.accessToken === "string" &&
    typeof row.refreshToken === "string"
  );
}

function writeVault(accounts: SavedAccount[]) {
  localStorage.setItem(KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
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
}

export async function switchToAccount(userId: string): Promise<void> {
  const account = readVault().find((a) => a.userId === userId);
  if (!account) throw new Error("That account is no longer saved on this device.");
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });
  if (error) {
    removeSavedAccount(userId);
    throw new Error("That saved session expired. Sign in again.");
  }
  await rememberCurrentSession();
}

export function removeSavedAccount(userId: string): void {
  writeVault(readVault().filter((a) => a.userId !== userId));
}

export async function signOutCurrent(): Promise<SavedAccount | null> {
  const { data } = await supabase.auth.getUser();
  const currentId = data.user?.id;
  await supabase.auth.signOut({ scope: "global" });
  if (currentId) removeSavedAccount(currentId);
  const next = readVault()[0] ?? null;
  if (next) {
    const { error } = await supabase.auth.setSession({
      access_token: next.accessToken,
      refresh_token: next.refreshToken,
    });
    if (error) {
      removeSavedAccount(next.userId);
      return null;
    }
    await rememberCurrentSession();
    return next;
  }
  return null;
}

export async function signOutAll(): Promise<void> {
  await supabase.auth.signOut({ scope: "global" });
  writeVault([]);
}

export async function prepareAddAccount(): Promise<void> {
  await rememberCurrentSession();
  await supabase.auth.signOut({ scope: "local" });
}

export function subscribeAccountRefresh(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (!session) return;
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      void rememberCurrentSession();
    }
  });
  return () => data.subscription.unsubscribe();
}
