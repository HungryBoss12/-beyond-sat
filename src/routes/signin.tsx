import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthOrDivider, GoogleAuthButton } from "@/components/GoogleAuthButton";
import { supabase } from "@/integrations/supabase/client";
import { appUrl } from "@/lib/app-url";
import { signInWithIdentifier } from "@/lib/auth/username-login";
import {
  listSavedAccounts,
  rememberCurrentSession,
  switchToAccount,
  type SavedAccount,
} from "@/lib/auth/account-switcher";

export const Route = createFileRoute("/signin")({
  component: SignIn,
  head: () => ({
    meta: [
      { title: "Sign In — BeyondSAT" },
      { name: "description", content: "Sign in to your BeyondSAT account." },
    ],
  }),
});

function isAddAccount(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("add") === "1";
}

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("don't match"))
    return "That username or email and password don't match. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please verify your email before signing in. Check your inbox for the code.";
  return msg;
}

function SignIn() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState<SavedAccount[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const adding = isAddAccount();

  useEffect(() => {
    setSaved(listSavedAccounts());
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isAddAccount()) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function finishSignIn() {
    await rememberCurrentSession();
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!identifier || !password) {
      setError("Please enter your username or email, and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithIdentifier(identifier, password);
      await finishSignIn();
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    setError(null);
    setInfo(null);
    if (!identifier.includes("@")) {
      setError("Enter the email on the account, then click Forgot password.");
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
      redirectTo: appUrl("/reset-password"),
    });
    setResetting(false);
    if (error) setError(error.message);
    else setInfo("Password reset email sent. Check your inbox.");
  }

  async function continueAs(account: SavedAccount) {
    setError(null);
    setSwitchingId(account.userId);
    try {
      await switchToAccount(account.userId);
      window.location.assign("/dashboard");
    } catch (err) {
      setSaved(listSavedAccounts());
      setError((err as Error).message);
      setSwitchingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="grid flex-1 place-items-center px-4 py-14">
        <div className="rise-in w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 p-8 shadow-panel md:p-10">
          <h1 className="text-center text-2xl font-black tracking-tight text-white md:text-3xl">
            {adding ? "Add an account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-center text-sm text-brand-100">
            {adding ? "Sign in to another BeyondSAT account on this device." : "Sign in to continue your prep."}
          </p>

          {!adding && saved.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-100">
                Continue as
              </p>
              {saved.map((account) => (
                <button
                  key={account.userId}
                  type="button"
                  disabled={switchingId === account.userId}
                  onClick={() => void continueAs(account)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-brand-400/40 bg-brand-800 px-3 py-2.5 text-left text-sm text-white hover:bg-brand-400/40 disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{account.displayName}</span>
                    <span className="block truncate text-[11px] text-brand-100">
                      {account.username ? `@${account.username}` : account.email}
                    </span>
                  </span>
                  {switchingId === account.userId ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : null}
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 space-y-4">
            <GoogleAuthButton
              disabled={loading || resetting}
              onError={(message) => {
                setInfo(null);
                setError(message);
              }}
            />
            <AuthOrDivider />
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-brand-100">
                Username or email
              </span>
              <input
                type="text"
                autoComplete="username"
                className={inputCls}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-brand-100">Password</span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  className={inputCls + " pr-10"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="tap absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-brand-100 hover:text-white"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && (
              <p className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign In
            </button>

            <div className="text-right">
              <button
                type="button"
                onClick={() => void handleForgot()}
                disabled={resetting}
                className="text-sm font-bold text-white hover:underline disabled:opacity-60"
              >
                Forgot password?
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-brand-100">
            New here?{" "}
            <Link to="/signup" className="font-bold text-white hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm text-white outline-none transition duration-200 [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:ring-2 focus:ring-brand-300/50";
