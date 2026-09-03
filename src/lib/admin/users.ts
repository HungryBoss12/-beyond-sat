import { supabase } from "@/integrations/supabase/client";

export type AdminUserSummaryRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_seen_at: string | null;
  banned: boolean;
  role: string;
  tests_total: number;
  tests_mock: number;
  tests_daily: number;
  tests_practice: number;
  current_streak: number;
  last_active_at: string | null;
  class_name: string | null;
  accuracy_pct: number | null;
};

export type AdminUserDetail = {
  profile: Record<string, unknown>;
  student_profile: Record<string, unknown> | null;
  role: string;
  class_name: string | null;
  stats: {
    tests_total: number;
    tests_mock: number;
    tests_daily: number;
    tests_practice: number;
    tests_completed: number;
    tests_in_progress: number;
    best_mock_score: number | null;
    accuracy_pct: number | null;
    attempts_total: number;
    vocab_cards: number;
    vocab_due: number;
    vocab_quiz_attempts: number;
    vocab_reviews_7d: number;
  };
};

export type AdminUserSessionRow = {
  id: string;
  type: string;
  title: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  rw_score: number | null;
  math_score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  in_progress: boolean;
};

export type AdminActivityRow = {
  occurred_at: string;
  kind: string;
  summary: string;
  meta: Record<string, unknown> | null;
};

export type TelegramLinkStatus = {
  linked: boolean;
  chat_id: number | null;
};

export type TelegramAdminRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  chat_id: number;
  banned: boolean;
  banned_reason: string | null;
  is_self: boolean;
};

function missingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && ["42883", "42703", "42P01", "PGRST202"].includes(error.code)) return true;
  return /does not exist|could not find/i.test(error.message ?? "");
}

export async function fetchAdminUsersSummary(): Promise<{
  rows: AdminUserSummaryRow[];
  migrationReady: boolean;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("admin_users_summary");
  if (error) {
    if (missingRpc(error)) {
      return { rows: [], migrationReady: false, error: null };
    }
    return { rows: [], migrationReady: true, error: error.message };
  }
  return {
    rows: (data ?? []) as AdminUserSummaryRow[],
    migrationReady: true,
    error: null,
  };
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: userId });
  if (error) throw new Error(error.message);
  return data as AdminUserDetail;
}

export async function fetchAdminUserSessions(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<AdminUserSessionRow[]> {
  const { data, error } = await supabase.rpc("admin_user_sessions", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserSessionRow[];
}

export async function fetchAdminUserActivity(
  userId: string,
  limit = 80,
): Promise<AdminActivityRow[]> {
  const { data, error } = await supabase.rpc("admin_user_activity", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminActivityRow[];
}

export async function fetchTelegramLinkStatus(): Promise<TelegramLinkStatus | null> {
  const { data, error } = await supabase.rpc("admin_telegram_link_status");
  if (error) {
    if (missingRpc(error)) return null;
    throw new Error(error.message);
  }
  return data as TelegramLinkStatus;
}

export async function createTelegramLinkCode(): Promise<string> {
  const { data, error } = await supabase.rpc("admin_create_telegram_link_code");
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) throw new Error("No link code returned");
  return data;
}

export async function unlinkTelegram(): Promise<void> {
  const { error } = await supabase.rpc("admin_unlink_telegram");
  if (error) throw new Error(error.message);
}

export async function fetchTelegramAdmins(): Promise<TelegramAdminRow[]> {
  const { data, error } = await supabase.rpc("admin_list_telegram_admins");
  if (error) {
    if (missingRpc(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as TelegramAdminRow[];
}

export async function revokeTelegramAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_revoke_telegram_admin", { p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function setAdminBanned(
  userId: string,
  banned: boolean,
  reason?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("admin_set_banned", {
    p_user_id: userId,
    p_banned: banned,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}
