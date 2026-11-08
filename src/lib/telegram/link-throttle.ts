import { sharedRateLimit } from "@/lib/shared-rate-limit";

/** A linked chat gets admin powers, so link codes must not be guessable by retrying. */
export async function linkAttemptAllowed(env: unknown, chatId: number): Promise<boolean> {
  const limit = await sharedRateLimit(env, `tg-link:${chatId}`, 5, 1);
  return limit.ok;
}
