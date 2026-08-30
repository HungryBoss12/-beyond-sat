import {
  answerCallbackQuery,
  sendTelegramMessage,
  verifyWebhookSecret,
  type TelegramUpdate,
} from "./api";
import {
  banConfirmKeyboard,
  formatHelp,
  formatSessions,
  formatStart,
  formatUserOverview,
  formatUsersList,
  parseCallbackData,
  parseCommand,
  unbanConfirmKeyboard,
} from "./admin-bot";
import { hydrateServerEnv, readTelegramToken, readWebhookSecret } from "./env";
import {
  consumeLinkCode,
  fetchUserDetail,
  fetchUserSessions,
  findUserByEmailOrId,
  resolveAdminByChat,
  searchUsers,
  setUserBanned,
} from "./user-queries";

export async function handleTelegramWebhook(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = readWebhookSecret(env);
  if (!verifyWebhookSecret(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = readTelegramToken(env);
  if (!token) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN not configured");
    return new Response("Server misconfigured", { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  hydrateServerEnv(env);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const chatId =
    update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? null;
  if (chatId == null) {
    return new Response("OK");
  }

  if (update.callback_query) {
    await handleCallback(update, token, chatId, supabaseAdmin);
    return new Response("OK");
  }

  const text = update.message?.text?.trim();
  if (!text) return new Response("OK");

  const cmd = parseCommand(text);
  await dispatchCommand(cmd, token, chatId, supabaseAdmin);
  return new Response("OK");
}

async function handleCallback(
  update: TelegramUpdate,
  token: string,
  chatId: number,
  supabase: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
) {
  const cq = update.callback_query!;
  await answerCallbackQuery(token, cq.id);

  const adminId = await resolveAdminByChat(supabase, chatId);
  if (!adminId) {
    await sendTelegramMessage(token, chatId, "Not linked. Use /link CODE from Admin → Settings.");
    return;
  }

  const cmd = parseCallbackData(cq.data ?? "");
  if (cmd.kind === "cancel") {
    await sendTelegramMessage(token, chatId, "Cancelled.");
    return;
  }
  if (cmd.kind === "confirm") {
    try {
      if (cmd.action === "ban") {
        if (cmd.userId === adminId) {
          await sendTelegramMessage(token, chatId, "You cannot ban your own account.");
          return;
        }
        await setUserBanned(supabase, cmd.userId, true, cmd.reason ?? null);
        await sendTelegramMessage(token, chatId, "User banned.");
      } else {
        await setUserBanned(supabase, cmd.userId, false, null);
        await sendTelegramMessage(token, chatId, "User unbanned.");
      }
    } catch (e) {
      await sendTelegramMessage(
        token,
        chatId,
        e instanceof Error ? e.message : "Action failed.",
      );
    }
  }
}

async function dispatchCommand(
  cmd: ReturnType<typeof parseCommand>,
  token: string,
  chatId: number,
  supabase: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
) {
  const linked = !!(await resolveAdminByChat(supabase, chatId));

  if (cmd.kind === "link") {
    if (!cmd.code) {
      await sendTelegramMessage(token, chatId, "Usage: /link AB12CD");
      return;
    }
    const result = await consumeLinkCode(supabase, cmd.code, chatId);
    await sendTelegramMessage(
      token,
      chatId,
      result.ok
        ? "Linked! You can now use admin commands. Send /help for the list."
        : result.error ?? "Link failed.",
    );
    return;
  }

  if (cmd.kind === "start") {
    await sendTelegramMessage(token, chatId, formatStart(linked));
    return;
  }

  if (cmd.kind === "help") {
    await sendTelegramMessage(token, chatId, formatHelp(linked));
    return;
  }

  if (!linked) {
    await sendTelegramMessage(
      token,
      chatId,
      "This chat is not authorized. Generate a link code in Admin → Settings and send /link CODE.",
    );
    return;
  }

  try {
    switch (cmd.kind) {
      case "users": {
        const rows = await searchUsers(supabase, cmd.query);
        await sendTelegramMessage(token, chatId, formatUsersList(rows));
        break;
      }
      case "user": {
        if (!cmd.arg) {
          await sendTelegramMessage(token, chatId, "Usage: /user email_or_id");
          break;
        }
        const user = await findUserByEmailOrId(supabase, cmd.arg);
        if (!user) {
          await sendTelegramMessage(token, chatId, "User not found.");
          break;
        }
        const detail = await fetchUserDetail(supabase, user.id);
        if (!detail) {
          await sendTelegramMessage(token, chatId, "User not found.");
          break;
        }
        await sendTelegramMessage(token, chatId, formatUserOverview(detail));
        break;
      }
      case "tests": {
        if (!cmd.arg) {
          await sendTelegramMessage(token, chatId, "Usage: /tests email_or_id");
          break;
        }
        const user = await findUserByEmailOrId(supabase, cmd.arg);
        if (!user) {
          await sendTelegramMessage(token, chatId, "User not found.");
          break;
        }
        const sessions = await fetchUserSessions(supabase, user.id, 5);
        await sendTelegramMessage(token, chatId, formatSessions(sessions));
        break;
      }
      case "ban": {
        if (!cmd.email) {
          await sendTelegramMessage(token, chatId, "Usage: /ban email [reason]");
          break;
        }
        const user = await findUserByEmailOrId(supabase, cmd.email);
        if (!user) {
          await sendTelegramMessage(token, chatId, "User not found.");
          break;
        }
        const adminId = await resolveAdminByChat(supabase, chatId);
        if (adminId && user.id === adminId) {
          await sendTelegramMessage(token, chatId, "You cannot ban your own account.");
          break;
        }
        await sendTelegramMessage(
          token,
          chatId,
          `Ban ${user.email ?? user.id}?`,
          { replyMarkup: banConfirmKeyboard(user.id, cmd.reason) },
        );
        break;
      }
      case "unban": {
        if (!cmd.email) {
          await sendTelegramMessage(token, chatId, "Usage: /unban email");
          break;
        }
        const user = await findUserByEmailOrId(supabase, cmd.email);
        if (!user) {
          await sendTelegramMessage(token, chatId, "User not found.");
          break;
        }
        await sendTelegramMessage(token, chatId, `Unban ${user.email ?? user.id}?`, {
          replyMarkup: unbanConfirmKeyboard(user.id),
        });
        break;
      }
      default:
        await sendTelegramMessage(token, chatId, "Unknown command. Send /help.");
    }
  } catch (e) {
    await sendTelegramMessage(
      token,
      chatId,
      e instanceof Error ? e.message : "Something went wrong.",
    );
  }
}
