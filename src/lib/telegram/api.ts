const TELEGRAM_API = "https://api.telegram.org";

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  from?: TelegramUser;
};

export type TelegramUser = {
  id: number;
  first_name?: string;
  username?: string;
};

export async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  options?: { replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] } },
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (options?.replyMarkup) body.reply_markup = options.replyMarkup;

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[telegram] sendMessage failed", e);
    return false;
  }
}

export async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: !!text,
      }),
    });
  } catch (e) {
    console.error("[telegram] answerCallbackQuery failed", e);
  }
}

export function verifyWebhookSecret(request: Request, expected: string | undefined): boolean {
  if (!expected) return false;
  const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  return header === expected;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
