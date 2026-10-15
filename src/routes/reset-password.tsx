import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { rememberCurrentSession } from "@/lib/auth/account-switcher";
import { pathAfterSignIn } from "@/lib/auth/after-sign-in";
import { PanelGlow } from "@/components/ui/panel";
import { AmbientGlow, RevealCard } from "@/components/ui/reveal-card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Reset password — BeyondSAT" },
      { name: "description", content: "Choose a new BeyondSAT password." },
    ],
  }),
});

function recoveryLink(): boolean {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (hash.get("type") === "recovery") return true;
  return new URLSearchParams(window.location.search).get("type") === "recovery";
}

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fromRecoveryLink = recoveryLink();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });

    void (async () => {
      const code = new URL(window.location.href).searchParams.get("code");
      if (code && fromRecoveryLink) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !exchangeError) {
          setReady(true);
          setChecking(false);
          return;
        }
      }
      if (!cancelled && fromRecoveryLink) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) setReady(true);
      }
      if (!cancelled) setChecking(false);
    })();

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await rememberCurrentSession();
    navigate({ to: await pathAfterSignIn(), replace: true });
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-white">
      <AmbientGlow />
      <SiteNav />
      <main className="relative grid flex-1 place-items-center px-4 py-14">
        <RevealCard className="rise-in relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 p-8 shadow-brand md:p-10">
          <PanelGlow />
          <div className="relative">
            <h1 className="text-center text-2xl font-black tracking-tight text-white md:text-3xl">
              Choose a new password
            </h1>
            <p className="mt-2 text-center text-sm text-brand-100">
              Use at least 8 characters. This replaces the password on the account.
            </p>

            {checking ? (
              <div className="mt-8 grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : !ready ? (
              <div className="mt-8 space-y-4">
                <p className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                  Open the reset link from your email, then choose a password here.
                </p>
                <Link
                  to="/signin"
                  className="btn-brand inline-flex w-full items-center justify-center rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4" noValidate>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-brand-100">New password</span>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
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
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-brand-100">Confirm password</span>
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    className={inputCls}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                {error && (
                  <p className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save password
                </button>
              </form>
            )}
          </div>
        </RevealCard>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm text-white outline-none transition duration-200 [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:ring-2 focus:ring-brand-300/50";
