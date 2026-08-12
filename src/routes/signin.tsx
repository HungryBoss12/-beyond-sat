import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { appUrl } from "@/lib/app-url";

export const Route = createFileRoute("/signin")({
  component: SignIn,
  head: () => ({
    meta: [
      { title: "Sign In — BeyondSAT" },
      { name: "description", content: "Sign in to your BeyondSAT account." },
    ],
  }),
});

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please verify your email before signing in. Check your inbox for the code.";
  return msg;
}

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleForgot() {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl("/reset-password"),
    });
    setResetting(false);
    if (error) setError(error.message);
    else setInfo("Password reset email sent. Check your inbox.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="grid flex-1 place-items-center px-4 py-14">
        <div className="rise-in w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 p-8 shadow-panel md:p-10">
          <h1 className="text-center text-2xl font-black tracking-tight text-white md:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-center text-sm text-brand-100">Sign in to continue your prep.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-brand-100">Email</span>
              <input
                type="email"
                autoComplete="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

            {/* Red/green feedback can't live on a brand surface — both states use the
                same deep chip and are told apart by their wording. */}
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
                onClick={handleForgot}
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
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200";
