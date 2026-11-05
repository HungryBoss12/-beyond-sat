import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SignInOrb } from "@/components/SignInOrb";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/auth/username-login";
import { pathAfterSignIn } from "@/lib/auth/after-sign-in";
import { ADMIN_SESSION_HOURS, isKeepSignedIn, setKeepSignedIn } from "@/lib/auth/session-policy";
import {
  listSavedAccounts,
  rememberCurrentSession,
  switchToAccount,
  type SavedAccount,
} from "@/lib/auth/account-switcher";
import { PanelGlow } from "@/components/ui/panel";
import { useRegistrationEnabled } from "@/lib/registration";
import { AmbientGlow, RevealCard } from "@/components/ui/reveal-card";

export const Route = createFileRoute("/signin")({
  component: SignIn,
  head: () => ({
    meta: [
      { title: "Sign In — BeyondSAT" },
      { name: "description", content: "Sign in to your BeyondSAT account." },
    ],
  }),
});

function SmoothTypeField({
  value,
  mask = false,
  className = "",
  overlayClassName = "",
  onSelect,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  value: string;
  mask?: boolean;
  overlayClassName?: string;
}) {
  const text = value ?? "";
  const prev = useRef(text);
  const [freshFrom, setFreshFrom] = useState(text.length);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    const before = prev.current;
    prev.current = text;
    const added = text.length - before.length;
    if (added > 0 && added <= 16 && text.startsWith(before)) {
      setFreshFrom(before.length);
      return;
    }
    setFreshFrom(text.length);
  }, [text]);

  const shown = mask ? "•".repeat(text.length) : text;

  return (
    <div className="relative">
      <input
        {...rest}
        value={text}
        onSelect={(event) => {
          const field = event.currentTarget;
          setSelecting(field.selectionStart !== field.selectionEnd);
          onSelect?.(event);
        }}
        className={className + (selecting ? " caret-white" : " caret-white text-transparent")}
      />
      <span
        aria-hidden="true"
        className={
          "pointer-events-none absolute inset-0 flex items-center overflow-hidden px-5 text-sm text-white" +
          (selecting ? " opacity-0" : "") +
          (overlayClassName ? " " + overlayClassName : "")
        }
      >
        <span className="sign-glyph-row">
          {Array.from(shown).map((glyph, index) => (
            <span
              key={index}
              className={index >= freshFrom ? "sign-glyph-in" : undefined}
              style={index >= freshFrom ? { animationDelay: `${(index - freshFrom) * 28}ms` } : undefined}
            >
              {glyph}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}

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
  if (m.includes("suspended")) return "This account is suspended.";
  return msg;
}

/** Phones keep one canvas, in the footer. The side-by-side layout starts at 640px. */
function useSignInOrbSlot(): "pending" | "phone" | "desk" {
  const [slot, setSlot] = useState<"pending" | "phone" | "desk">("pending");
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSlot(mq.matches ? "phone" : "desk");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return slot;
}

function SignIn() {
  const navigate = useNavigate();
  const orbSlot = useSignInOrbSlot();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState<SavedAccount[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [keep, setKeep] = useState(true);
  const adding = isAddAccount();
  const registrationOn = useRegistrationEnabled();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expired") === "admin") {
      setInfo(
        `Admin sessions end ${ADMIN_SESSION_HOURS} hours after you sign in. Sign in again to continue.`,
      );
    }
    setSaved(listSavedAccounts());
    setKeep(isKeepSignedIn());
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && !isAddAccount()) navigate({ to: await pathAfterSignIn(), replace: true });
    });
  }, [navigate]);

  async function finishSignIn() {
    await rememberCurrentSession();
    navigate({ to: await pathAfterSignIn(), replace: true });
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
      setKeepSignedIn(keep);
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
    if (!identifier.trim()) {
      setError("Enter your username or email, then click Forgot password.");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not send the reset email.");
        return;
      }
      setInfo("If that account can receive email, a reset link is on its way.");
    } catch {
      setError("Could not send the reset email.");
    } finally {
      setResetting(false);
    }
  }

  async function continueAs(account: SavedAccount) {
    setError(null);
    setSwitchingId(account.userId);
    try {
      setKeepSignedIn(keep);
      await switchToAccount(account.userId);
      window.location.assign(await pathAfterSignIn());
    } catch (err) {
      setSaved(listSavedAccounts());
      setError((err as Error).message);
      setSwitchingId(null);
    }
  }

  return (
    <div className="marketing relative isolate flex min-h-screen flex-col bg-white">
      <AmbientGlow />
      <SiteNav />
      <main className="relative flex-1 overflow-hidden bg-brand-600 pt-3 text-white sm:pt-6">
        <div className="rise-in relative mx-auto grid max-w-7xl items-center sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div aria-hidden="true" className="grid-fade-dark pointer-events-none absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 h-80 w-[32rem] rounded-full bg-brand-400/35 blur-3xl"
          />
          <p
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-6 left-[-2%] select-none text-[24vw] font-semibold leading-none tracking-[-0.06em] text-white/[0.06] lg:text-[11rem]"
          >
            beyond
          </p>

          <section className="relative px-6 pb-4 pt-12 sm:col-span-2 sm:px-10 sm:pt-16">
            <h1 className="max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.045em] text-white sm:text-6xl md:text-7xl">
              {adding ? "Add an account." : "Welcome back."}
              <span className="block text-brand-200">
                {adding ? "Switch in one tap." : "Pick up your prep."}
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-brand-100">
              {adding
                ? "Sign in to another BeyondSAT account on this device."
                : "Sign in to continue your Digital SAT practice. Your scores and streak are waiting."}
            </p>
          </section>

          <div className="relative hidden items-center justify-center px-6 pb-2 sm:flex sm:py-8">
            {orbSlot === "desk" ? (
              <SignInOrb className="h-52 w-52 shrink-0 lg:h-64 lg:w-64" />
            ) : null}
          </div>

          <div className="relative p-3 sm:p-5 lg:p-6">
            <RevealCard className="relative overflow-hidden rounded-[1.5rem] bg-brand-800/60 p-6 ring-1 ring-white/10 backdrop-blur-sm sm:h-full sm:p-8">
              <PanelGlow />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">
                  Sign in
                </p>
                {!adding && saved.length > 0 && (
                  <div className="stagger mt-6 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-100">
                      Continue as
                    </p>
                    {saved.map((account) => (
                      <button
                        key={account.userId}
                        type="button"
                        disabled={switchingId === account.userId}
                        onClick={() => void continueAs(account)}
                        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-left text-sm text-white transition-all duration-200 hover:bg-white/15 disabled:opacity-60"
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

                <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4" noValidate>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-brand-100">
                      Username or email
                    </span>
                    <SmoothTypeField
                      type="text"
                      autoComplete="username"
                      className={inputCls}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-brand-100">
                      Password
                    </span>
                    <div className="relative">
                      <SmoothTypeField
                        type={showPw ? "text" : "password"}
                        autoComplete="current-password"
                        mask={!showPw}
                        overlayClassName="pr-10"
                        className={inputCls + " pr-10"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="tap absolute right-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-brand-100 hover:text-white"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={keep}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setKeep(next);
                        setKeepSignedIn(next);
                        if (next) void rememberCurrentSession();
                      }}
                      className="h-4 w-4 rounded border-brand-300 accent-brand-300"
                    />
                    Keep me signed in
                  </label>

                  {error && (
                    <p className="pop-in rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                      {error}
                    </p>
                  )}
                  {info && (
                    <p className="pop-in rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                      {info}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign In
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => void handleForgot()}
                      disabled={resetting}
                      className="text-sm font-semibold text-brand-100 hover:text-white disabled:opacity-60"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>

                {registrationOn && (
                  <p className="mt-6 text-center text-sm text-brand-100">
                    New here?{" "}
                    <Link to="/signup" className="font-bold text-white hover:underline">
                      Create an account
                    </Link>
                  </p>
                )}
              </div>
            </RevealCard>
          </div>
        </div>
      </main>
      <SiteFooter
        mobileOrb={
          orbSlot === "phone" ? <SignInOrb className="h-44 w-44 shrink-0" /> : null
        }
      />
    </div>
  );
}

const inputCls =
  "w-full rounded-full border border-white/20 bg-transparent px-5 py-3 text-sm text-white outline-none transition duration-200 [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:bg-white/15 focus:ring-2 focus:ring-brand-200/40";
