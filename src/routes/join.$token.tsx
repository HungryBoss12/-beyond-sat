import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { AmbientGlow, RevealCard } from "@/components/ui/reveal-card";
import { PanelGlow } from "@/components/ui/panel";
import { CLASS_CONTROL } from "@/components/classes/control";
import { claimInvite, previewInvite } from "@/lib/students/api";
import { signInWithUsername } from "@/lib/auth/username-login";
import { rememberCurrentSession } from "@/lib/auth/account-switcher";

export const Route = createFileRoute("/join/$token")({
  component: JoinAccount,
  head: () => ({
    meta: [
      { title: "Set up your account — BeyondSAT" },
      { name: "description", content: "Choose your name, username, and password." },
    ],
  }),
});

function JoinAccount() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void previewInvite(token)
      .then((row) => {
        if (!live) return;
        setName(row.name);
        setUsername(row.username);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "This link is not valid.");
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Enter your name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const saved = await claimInvite({ token, name: name.trim(), username, password });
      await signInWithUsername(saved.username, password);
      await rememberCurrentSession();
      await navigate({ to: "/onboarding", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your account.");
      setSaving(false);
    }
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
              Set up your account
            </h1>
            <p className="mt-2 text-center text-sm text-white">
              Choose the name, username, and password you will use to sign in.
            </p>
            {loading ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white">Name</span>
                  <input
                    className={CLASS_CONTROL}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white">Username</span>
                  <input
                    className={CLASS_CONTROL}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white">Password</span>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      className={CLASS_CONTROL + " pr-10"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="tap absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-white"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white">Confirm password</span>
                  <input
                    type={showPw ? "text" : "password"}
                    className={CLASS_CONTROL}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    disabled={saving}
                  />
                </label>
                {error && (
                  <p className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving || Boolean(error && !name)}
                  className="btn-brand w-full rounded-lg bg-brand-400 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Continue"}
                </button>
              </form>
            )}
          </div>
        </RevealCard>
      </main>
    </div>
  );
}
