import { accountEmailFor, isSyntheticAccountEmail } from "./login-email";

export type FirstLoginAuthUpdate = {
  attributes: { password: string; email?: string; email_confirm?: boolean };
  /** A typed address only becomes the account email after its owner clicks Supabase's link. */
  pendingEmail: string | null;
};

/**
 * Marking a typed address as confirmed would let a student claim someone
 * else's email, which Google sign-in then links to the student's account.
 * Only the placeholder username address is ever set as confirmed here.
 */
export function firstLoginAuthUpdate(input: {
  password: string;
  nextEmail: string;
  nextUsername: string | null;
  prevUsername: string | null;
  currentEmail: string | null;
}): FirstLoginAuthUpdate {
  const { password, nextEmail, nextUsername, prevUsername, currentEmail } = input;
  if (nextEmail) return { attributes: { password }, pendingEmail: nextEmail };
  if (nextUsername && nextUsername !== prevUsername && isSyntheticAccountEmail(currentEmail)) {
    return {
      attributes: { password, email: accountEmailFor(nextUsername), email_confirm: true },
      pendingEmail: null,
    };
  }
  return { attributes: { password }, pendingEmail: null };
}

export function firstLoginErrorMessage(raw: string | null | undefined): string {
  if (raw && /username taken/i.test(raw)) return "That username is already taken.";
  return "Could not update your account.";
}
