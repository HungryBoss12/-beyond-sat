import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ban, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/banned")({
  ssr: false,
  component: Banned,
  head: () => ({ meta: [{ title: "Account suspended — BeyondSAT" }] }),
});

function Banned() {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);

  /* Sends anyone who isn't actually banned back to the app, so an unban takes
     effect on the next load without the user having to know to navigate away. */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return void navigate({ to: "/signin", replace: true });
      const { data: prof } = await supabase
        .from("profiles")
        .select("banned,banned_reason")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!prof?.banned) return void navigate({ to: "/dashboard", replace: true });
      setReason(prof.banned_reason ?? null);
    })();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-white px-4">
      <div className="rise-in w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center shadow-panel">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-800 ring-1 ring-brand-300/60">
          <Ban className="h-7 w-7 text-white" />
        </span>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-white">Account suspended</h1>
        <p className="mt-2 text-sm text-brand-100">
          Your access to BeyondSAT has been suspended by an administrator.
        </p>
        {reason && (
          <p className="mt-4 rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
            {reason}
          </p>
        )}
        <button
          onClick={signOut}
          className="btn-brand mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
