import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallback,
  head: () => ({
    meta: [
      { title: "Signing in — BeyondSAT" },
      { name: "description", content: "Finishing Google sign-in." },
    ],
  }),
});

function callbackError(url: URL): string | null {
  const desc = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  return desc?.replace(/\+/g, " ").trim() || null;
}

async function establishSession(): Promise<void> {
  const url = new URL(window.location.href);
  const fromProvider = callbackError(url);
  if (fromProvider) throw new Error(fromProvider);

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return;

  throw new Error("Could not complete sign-in. Try Google again from the sign-in page.");
}

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await establishSession();
        if (cancelled) return;
        navigate({ to: "/dashboard", replace: true });
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message ?? "Sign-in failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="grid flex-1 place-items-center px-4 py-14">
        <div className="rise-in w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center shadow-panel md:p-10">
          {error ? (
            <>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Sign-in did not finish
              </h1>
              <p className="mt-3 rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                {error}
              </p>
              <Link
                to="/signin"
                className="btn-brand mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black tracking-tight text-white">Signing you in</h1>
              <p className="mt-2 text-sm text-brand-100">Just a moment — then we’ll continue.</p>
              <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-white" />
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
