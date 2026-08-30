import type { AdminUserDetail, AdminUserSessionRow, AdminUserSummaryRow } from "@/lib/admin/users";
import { escapeHtml } from "./api";

export type ParsedCommand =
  | { kind: "start" }
  | { kind: "help" }
  | { kind: "link"; code: string }
  | { kind: "users"; query: string }
  | { kind: "user"; arg: string }
  | { kind: "tests"; arg: string }
  | { kind: "ban"; email: string; reason: string | null }
  | { kind: "unban"; email: string }
  | { kind: "confirm"; action: "ban" | "unban"; userId: string; reason?: string | null }
  | { kind: "cancel" }
  | { kind: "unknown"; raw: string };

export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return { kind: "unknown", raw: trimmed };

  const [cmd, ...rest] = trimmed.split(/\s+/);
  const lower = cmd.toLowerCase();
  const arg = rest.join(" ").trim();

  if (lower === "/start") return { kind: "start" };
  if (lower === "/help") return { kind: "help" };
  if (lower === "/link") return { kind: "link", code: arg };
  if (lower === "/users") return { kind: "users", query: arg };
  if (lower === "/user") return { kind: "user", arg };
  if (lower === "/tests") return { kind: "tests", arg };
  if (lower === "/ban") {
    const [email, ...reasonParts] = arg.split(/\s+/);
    return { kind: "ban", email: email ?? "", reason: reasonParts.join(" ").trim() || null };
  }
  if (lower === "/unban") return { kind: "unban", email: arg };
  return { kind: "unknown", raw: trimmed };
}

export function parseCallbackData(data: string): ParsedCommand {
  if (data === "cancel") return { kind: "cancel" };
  const ban = /^ban:([^:]+)(?::(.*))?$/.exec(data);
  if (ban) {
    return {
      kind: "confirm",
      action: "ban",
      userId: ban[1],
      reason: ban[2] ? decodeURIComponent(ban[2]) : null,
    };
  }
  const unban = /^unban:(.+)$/.exec(data);
  if (unban) return { kind: "confirm", action: "unban", userId: unban[1] };
  return { kind: "unknown", raw: data };
}

export function formatHelp(linked: boolean): string {
  const lines = [
    "<b>Beyond SAT Admin Bot</b>",
    "",
    "/users [search] — list users (top 10)",
    "/user email_or_id — user overview",
    "/tests email_or_id — last 5 test sessions",
    "/ban email [reason] — ban a user",
    "/unban email — unban a user",
    "/help — this message",
  ];
  if (!linked) {
    lines.unshift("Link your admin account first: generate a code in Admin → Settings, then /link CODE");
  }
  return lines.join("\n");
}

export function formatStart(linked: boolean): string {
  if (linked) {
    return "You're linked as an admin.\n\n" + formatHelp(true);
  }
  return (
    "Welcome to the Beyond SAT admin bot.\n\n" +
    "1. Open Admin → Settings on the site\n" +
    "2. Generate a Telegram link code\n" +
    "3. Send /link YOUR_CODE here\n\n" +
    formatHelp(false)
  );
}

export function formatUsersList(
  rows: Pick<AdminUserSummaryRow, "full_name" | "email" | "id" | "tests_total" | "current_streak">[],
): string {
  if (rows.length === 0) return "No users found.";
  return rows
    .map((r) => {
      const name = escapeHtml(r.full_name || r.email || r.id.slice(0, 8));
      const email = r.email ? escapeHtml(r.email) : "—";
      return `• <b>${name}</b>\n  ${email} · ${r.tests_total} tests · streak ${r.current_streak}`;
    })
    .join("\n\n");
}

export function formatUserOverview(detail: AdminUserDetail): string {
  const p = detail.profile as {
    email?: string | null;
    full_name?: string | null;
    banned?: boolean;
    city?: string | null;
    school?: string | null;
  };
  const s = detail.stats;
  const lines = [
    `<b>${escapeHtml(p.full_name || p.email || "User")}</b>`,
    p.email ? escapeHtml(p.email) : "",
    `Role: ${escapeHtml(detail.role)}${detail.class_name ? ` · ${escapeHtml(detail.class_name)}` : ""}`,
    p.banned ? "<b>BANNED</b>" : "",
    "",
    `Tests: ${s.tests_total} (${s.tests_mock} mock, ${s.tests_daily} daily, ${s.tests_practice} practice)`,
    s.accuracy_pct != null ? `Accuracy: ${s.accuracy_pct}%` : "Accuracy: —",
    s.best_mock_score != null ? `Best mock: ${s.best_mock_score}` : "",
    `Vocab: ${s.vocab_cards} cards, ${s.vocab_due} due, ${s.vocab_quiz_attempts} quizzes`,
    `Vocab reviews (7d): ${s.vocab_reviews_7d}`,
  ].filter(Boolean);
  if (p.city || p.school) {
    lines.push("", [p.city, p.school].filter(Boolean).map(escapeHtml).join(" · "));
  }
  return lines.join("\n");
}

export function formatSessions(sessions: AdminUserSessionRow[]): string {
  if (sessions.length === 0) return "No test sessions.";
  return sessions
    .map((s) => {
      const score = s.score != null ? String(s.score) : s.in_progress ? "in progress" : "—";
      return `• ${escapeHtml(s.title)} (${s.type})\n  Score: ${score}`;
    })
    .join("\n\n");
}

export function banConfirmKeyboard(userId: string, reason: string | null) {
  const base = `ban:${userId}`;
  let callbackData = base;
  if (reason) {
    const withReason = `${base}:${encodeURIComponent(reason)}`;
    if (withReason.length <= 64) callbackData = withReason;
  }
  return {
    inline_keyboard: [
      [
        { text: "Confirm ban", callback_data: callbackData },
        { text: "Cancel", callback_data: "cancel" },
      ],
    ],
  };
}

export function unbanConfirmKeyboard(userId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Confirm unban", callback_data: `unban:${userId}` },
        { text: "Cancel", callback_data: "cancel" },
      ],
    ],
  };
}
