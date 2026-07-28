import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
  head: () => ({ meta: [{ title: "Settings — Admin — BeyondSAT" }] }),
});

function AdminSettings() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", "desmos_api_key")
        .maybeSingle();
      setKey(((data as any)?.value as string) ?? "");
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("app_settings" as any)
      .upsert({ key: "desmos_api_key", value: key.trim() }, { onConflict: "key" });
    setSaving(false);
    if (error) return alert(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-black text-primary">Site settings</h2>
        <p className="text-sm text-slate-600 mt-1">
          Configure integrations and site-wide options.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 soft-shadow">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-black text-primary">Desmos calculator</div>
            <p className="text-sm text-slate-600 mt-1">
              Paste your Desmos API key. When set, a floating Desmos calculator
              appears inside Math questions, daily tests, and mock exams. Get a
              free API key at{" "}
              <a
                href="https://www.desmos.com/api/v1.11/docs/index.html#document-api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                desmos.com/api
              </a>
              .
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Desmos API key
          </label>
          {loading ? (
            <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="dcb31709b452b1cf9dc26972add0fda6"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm font-mono"
            />
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
            {saved && (
              <span className="text-xs font-bold text-emerald-600">Saved.</span>
            )}
            {!key.trim() && !loading && (
              <span className="text-xs text-slate-500">
                Leave empty to disable the calculator.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
