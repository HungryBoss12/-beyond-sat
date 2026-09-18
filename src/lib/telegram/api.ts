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

/**
 * Constant-time-ish secret comparison. `===` short-circuits on the first
 * differing byte, leaking how much of a guessed prefix is right through
 * response timing. Hashing both sides first (SHA-256) makes the compare cost
 * independent of where a guess diverges; the digest also equalizes lengths, so
 * a length leak is gone too. WebCrypto is async, hence the promise.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i]! ^ vb[i]!;
  return diff === 0;
}

export async function verifyWebhookSecret(
  request: Request,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected) return false;
  const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!header) return false;
  return timingSafeEqual(header, expected);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
