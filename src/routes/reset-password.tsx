import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Reset Password — BeyondSAT" },
      { name: "description", content: "Choose a new password for your BeyondSAT account." },
    ],
  }),
});

async function establishRecoverySession(): Promise<void> {
  const url = new URL(window.location.href);
  const fromProvider = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (fromProvider) throw new Error(fromProvider.replace(/\+/g, " ").trim());

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return;

  throw new Error(
    "This reset link is invalid or has expired. Request a new one from the sign-in page.",
  );
}

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await establishRecoverySession();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message ?? "Could not verify your reset link.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("Password updated. Sign in with your new password.");
    setTimeout(() => navigate({ to: "/signin", replace: true }), 1500);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="grid flex-1 place-items-center px-4 py-14">
        <div className="rise-in w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 p-8 shadow-panel md:p-10">
          <h1 className="text-center text-2xl font-black tracking-tight text-white md:text-3xl">
            Choose a new password
          </h1>
          <p className="mt-2 text-center text-sm text-brand-100">
            Enter and confirm your new password below.
          </p>

          {!ready && !error && (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}

          {error && !ready && (
            <div className="mt-8 space-y-4">
              <p className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                {error}
              </p>
              <Link
                to="/signin"
                className="btn-brand inline-flex w-full items-center justify-center rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white"
              >
                Back to sign in
              </Link>
            </div>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-brand-100">
                  New password
                </span>
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
                <span className="mb-1 block text-xs font-semibold text-brand-100">
                  Confirm password
                </span>
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
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm text-white outline-none transition duration-200 [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:ring-2 focus:ring-brand-300/50";
