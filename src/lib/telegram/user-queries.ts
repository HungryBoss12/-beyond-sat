import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AdminUserDetail, AdminUserSessionRow } from "@/lib/admin/users";

export type UserLookup = { id: string; email: string | null; full_name: string | null };

type AdminClient = SupabaseClient<Database>;

export async function resolveAdminByChat(
  supabase: AdminClient,
  chatId: number,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("admin_by_telegram_chat", { p_chat_id: chatId });
  if (error || !data) return null;
  return data;
}

export async function consumeLinkCode(
  supabase: AdminClient,
  code: string,
  chatId: number,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("admin_consume_telegram_link_code", {
    p_code: code,
    p_chat_id: chatId,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? "Invalid code" };
  return { ok: true };
}

export async function searchUsers(
  supabase: AdminClient,
  query: string,
): Promise<
  {
    id: string;
    email: string | null;
    full_name: string | null;
    tests_total: number;
    current_streak: number;
  }[]
> {
  const needle = query.trim();
  let profileQuery = supabase.from("profiles").select("id,email,full_name");

  if (needle) {
    const escaped = needle.replace(/[%_]/g, "\\$&");
    profileQuery = profileQuery.or(`email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`);
  }

  const { data: profiles } = await profileQuery
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = profiles ?? [];
  const enriched = await Promise.all(
    rows.map(async (p) => {
      const [{ count }, { data: student }] = await Promise.all([
        supabase
          .from("test_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", p.id),
        supabase.from("student_profiles").select("current_streak").eq("user_id", p.id).maybeSingle(),
      ]);
      return {
        ...p,
        tests_total: count ?? 0,
        current_streak: student?.current_streak ?? 0,
      };
    }),
  );
  return enriched;
}

export async function findUserByEmailOrId(
  supabase: AdminClient,
  arg: string,
): Promise<UserLookup | null> {
  const trimmed = arg.trim();
  if (!trimmed) return null;

  if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", trimmed)
      .maybeSingle();
    return data;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .ilike("email", trimmed)
    .maybeSingle();
  return data;
}

export async function fetchUserDetail(
  supabase: AdminClient,
  userId: string,
): Promise<AdminUserDetail | null> {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return null;

  const [
    { data: student },
    { data: sessions },
    { data: attempts },
    { data: cards },
    { count: quizCount },
    { data: reviews7d },
    { data: roles },
    classResult,
  ] = await Promise.all([
    supabase.from("student_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("test_sessions").select("type,score,completed_at").eq("user_id", userId),
    supabase.from("attempts").select("is_correct").eq("user_id", userId),
    supabase.from("user_card_states").select("due").eq("user_id", userId),
    supabase
      .from("vocab_quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("vocab_activity_logs")
      .select("cards_reviewed")
      .eq("user_id", userId)
      .gte("activity_date", sevenDaysAgo()),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    profile.class_id
      ? supabase.from("classes").select("name").eq("id", profile.class_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sess = sessions ?? [];
  const att = (attempts ?? []).filter((a) => a.is_correct != null);
  const attCorrect = att.filter((a) => a.is_correct).length;
  const cardRows = cards ?? [];
  const now = Date.now();

  const role = roles?.some((r) => r.role === "admin")
    ? "admin"
    : roles?.some((r) => r.role === "editor")
      ? "editor"
      : "student";

  const mockScores = sess
    .filter((s) => s.type === "mock" && s.score != null)
    .map((s) => s.score as number);

  const { telegram_admin_chat_id: _tg, ...safeProfile } = profile;

  return {
    profile: safeProfile,
    student_profile: student ?? null,
    role,
    class_name: classResult.data?.name ?? null,
    stats: {
      tests_total: sess.length,
      tests_mock: sess.filter((s) => s.type === "mock").length,
      tests_daily: sess.filter((s) => s.type === "daily").length,
      tests_practice: sess.filter((s) => s.type === "practice").length,
      tests_completed: sess.filter((s) => s.completed_at).length,
      tests_in_progress: sess.filter((s) => !s.completed_at).length,
      best_mock_score: mockScores.length ? Math.max(...mockScores) : null,
      accuracy_pct: att.length ? Math.round((100 * attCorrect) / att.length) : null,
      attempts_total: att.length,
      vocab_cards: cardRows.length,
      vocab_due: cardRows.filter((c) => new Date(c.due).getTime() <= now).length,
      vocab_quiz_attempts: quizCount ?? 0,
      vocab_reviews_7d: (reviews7d ?? []).reduce((n, r) => n + r.cards_reviewed, 0),
    },
  };
}

export async function fetchUserSessions(
  supabase: AdminClient,
  userId: string,
  limit = 5,
): Promise<AdminUserSessionRow[]> {
  const { data } = await supabase
    .from("test_sessions")
    .select(
      "id,type,started_at,completed_at,score,rw_score,math_score,correct_count,total_questions,mock_exam_id,daily_test_id,metadata",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  const titles = await resolveSessionTitles(supabase, rows);

  return rows.map((s, i) => ({
    id: s.id,
    type: s.type,
    title: titles[i],
    started_at: s.started_at,
    completed_at: s.completed_at,
    score: s.score,
    rw_score: s.rw_score,
    math_score: s.math_score,
    correct_count: s.correct_count,
    total_questions: s.total_questions,
    in_progress: !s.completed_at,
  }));
}

async function resolveSessionTitles(
  supabase: AdminClient,
  rows: Array<{
    type: string;
    mock_exam_id: string | null;
    daily_test_id: string | null;
    metadata: unknown;
  }>,
): Promise<string[]> {
  const mockIds = [...new Set(rows.map((r) => r.mock_exam_id).filter(Boolean))] as string[];
  const dailyIds = [...new Set(rows.map((r) => r.daily_test_id).filter(Boolean))] as string[];
  const testIds = [
    ...new Set(
      rows
        .map((r) => {
          const meta = r.metadata as { test_id?: string } | null;
          return meta?.test_id;
        })
        .filter(Boolean),
    ),
  ] as string[];

  const [mocks, dailies, tests] = await Promise.all([
    mockIds.length
      ? supabase.from("mock_exams").select("id,title").in("id", mockIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    dailyIds.length
      ? supabase.from("daily_tests").select("id,title").in("id", dailyIds)
      : Promise.resolve({ data: [] as { id: string; title: string | null }[] }),
    testIds.length
      ? supabase.from("tests").select("id,title").in("id", testIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const mockMap = new Map((mocks.data ?? []).map((m) => [m.id, m.title]));
  const dailyMap = new Map((dailies.data ?? []).map((d) => [d.id, d.title]));
  const testMap = new Map((tests.data ?? []).map((t) => [t.id, t.title]));

  return rows.map((s) => {
    if (s.mock_exam_id && mockMap.get(s.mock_exam_id)) return mockMap.get(s.mock_exam_id)!;
    if (s.daily_test_id) {
      const t = dailyMap.get(s.daily_test_id);
      if (t) return t;
    }
    const tid = (s.metadata as { test_id?: string } | null)?.test_id;
    if (tid && testMap.get(tid)) return testMap.get(tid)!;
    if (s.type === "mock") return "Mock exam";
    if (s.type === "daily") return "Daily test";
    return "Practice set";
  });
}

export async function setUserBanned(
  supabase: AdminClient,
  userId: string,
  banned: boolean,
  reason: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      banned,
      banned_reason: banned ? reason : null,
      banned_at: banned ? new Date().toISOString() : null,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}
