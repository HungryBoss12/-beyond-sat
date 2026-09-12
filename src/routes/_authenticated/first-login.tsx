import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidUsername, normalizeUsername } from "@/lib/classes/types";
import { rememberCurrentSession } from "@/lib/auth/account-switcher";

export const Route = createFileRoute("/_authenticated/first-login")({
  component: FirstLogin,
  head: () => ({
    meta: [
      { title: "Set your password — BeyondSAT" },
      { name: "description", content: "Choose a new password before you start BeyondSAT." },
    ],
  }),
});

function FirstLogin() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("username,must_change_credentials,intro_completed")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!prof?.must_change_credentials) {
        navigate({ to: prof?.intro_completed ? "/dashboard" : "/onboarding", replace: true });
        return;
      }
      setUid(user.id);
      setCurrentUsername(prof.username ?? "");
      setUsername(prof.username ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setErr(null);
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    const nextUsername = username.trim() ? normalizeUsername(username) : currentUsername;
    if (username.trim() && !isValidUsername(nextUsername)) {
      setErr("Username must start with a letter and be 3–24 letters, numbers, or underscores.");
      return;
    }
    const nextEmail = email.trim();
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setErr("Enter a valid email, or leave it blank.");
      return;
    }

    setSaving(true);
    const { error: pwErr } = await supabase.auth.updateUser({
      password,
      ...(nextEmail ? { email: nextEmail } : {}),
    });
    if (pwErr) {
      setSaving(false);
      setErr(pwErr.message);
      return;
    }

    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        username: nextUsername || null,
        must_change_credentials: false,
        ...(nextEmail ? { email: nextEmail } : {}),
      })
      .eq("id", uid);
    if (profErr) {
      setSaving(false);
      setErr(profErr.message);
      return;
    }

    await rememberCurrentSession();
    setSaving(false);
    navigate({ to: "/onboarding", replace: true });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-xl border-2 border-brand-400/50 bg-brand-800 px-4 py-3 text-sm font-semibold text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

  return (
    <div className="grid min-h-screen place-items-center bg-white p-6">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="pop-in w-full max-w-md rounded-3xl border border-brand-400/40 bg-brand-600 p-8 text-white shadow-brand md:p-10"
      >
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-400 text-white">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          Choose your own password
        </h1>
        <p className="mt-2 text-sm text-brand-100">
          Your teacher created this account. Set a password you will remember, then pick your SAT
          goals. You can connect Google later from Profile.
        </p>
        {currentUsername && (
          <p className="mt-3 text-xs text-brand-100">
            Current username <span className="font-bold text-white">@{currentUsername}</span>
          </p>
        )}

        <label className="mt-6 block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-100">
            New password
          </span>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={fieldClass + " pr-12"}
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

        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-100">
            Confirm password
          </span>
          <input
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-100">
            Username (optional)
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={fieldClass}
            autoComplete="username"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-100">
            Email (optional)
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            autoComplete="email"
            placeholder="For password reset later"
          />
        </label>

        {err && (
          <div className="mt-3 rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-brand mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-400 py-3.5 font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save and continue
        </button>
      </form>
    </div>
  );
}
