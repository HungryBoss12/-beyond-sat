import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, Calculator, Sparkles, Wrench, KeyRound } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
  head: () => ({ meta: [{ title: "Settings — Admin — BeyondSAT" }] }),
});

/**
 * Every key this page reads or writes. Loading them in one query rather than one
 * per card keeps the page to a single round trip, and the shared `Settings` map
 * is what lets each card stay a dumb controlled input.
 */
const SETTING_KEYS = [
  "desmos_api_key",
  "openrouter_model_chat",
  "openrouter_model_quick",
  "openrouter_model_reasoning",
  "openrouter_model_vision",
  "maintenance_enabled",
  "maintenance_message",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];
type Settings = Record<SettingKey, string>;

const EMPTY: Settings = {
  desmos_api_key: "",
  openrouter_model_chat: "",
  openrouter_model_quick: "",
  openrouter_model_reasoning: "",
  openrouter_model_vision: "",
  maintenance_enabled: "false",
  maintenance_message: "",
};

/**
 * Shown as input placeholders — the router falls back to these when unset.
 * Must stay in step with DEFAULT_MODELS in src/lib/ai/router.ts; they're
 * duplicated because that module is Worker-side and this page is a client
 * bundle, and importing it here would be the only reason to.
 */
const MODEL_DEFAULTS = {
  openrouter_model_chat: "nvidia/nemotron-3-super-120b-a12b:free",
  openrouter_model_quick: "openrouter/free",
  openrouter_model_reasoning: "nvidia/nemotron-3-ultra-550b-a55b:free",
  openrouter_model_vision: "gemini-3-flash-preview",
} as const;

function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  /* Saving and "saved" are tracked per card rather than per page — three cards
     sharing one spinner would flash confirmation on the card you didn't touch. */
  const [savingCard, setSavingCard] = useState<string | null>(null);
  const [savedCard, setSavedCard] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", SETTING_KEYS as unknown as string[]);
      const next = { ...EMPTY };
      for (const row of (data as { key: string; value: string | null }[] | null) ?? []) {
        if ((SETTING_KEYS as readonly string[]).includes(row.key)) {
          next[row.key as SettingKey] = row.value ?? "";
        }
      }
      setSettings(next);
      setLoading(false);
    })();
  }, []);

  function set(key: SettingKey, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save(card: string, keys: SettingKey[], overrides?: Partial<Settings>) {
    setSavingCard(card);
    setSavedCard(null);
    const source = { ...settings, ...overrides };
    const rows = keys.map((key) => ({ key, value: source[key].trim() }));
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
    setSavingCard(null);
    if (error) return alert(error.message);
    setSavedCard(card);
    setTimeout(() => setSavedCard((c) => (c === card ? null : c)), 2500);
  }

  const maintenanceOn = settings.maintenance_enabled === "true";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* The page heading sits on the white background, so it stays dark; the
          cards below are brand surfaces and carry white copy. */}
      <div className="rise-in">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Site settings</h2>
        <p className="text-sm text-slate-500 mt-1">Configure integrations and site-wide options.</p>
      </div>

      {/* ---------------------------------------------------------------- */}
      <Card
        icon={Calculator}
        title="Desmos calculator"
        description={
          <>
            Paste your Desmos API key. When set, a floating Desmos calculator appears inside Math
            questions, daily tests, and mock exams. Get a free API key at{" "}
            <a
              href="https://www.desmos.com/api/v1.11/docs/index.html#document-api-keys"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-white underline"
            >
              desmos.com/api
            </a>
            .
          </>
        }
      >
        <Field label="Desmos API key">
          {loading ? (
            <InputSkeleton />
          ) : (
            <input
              value={settings.desmos_api_key}
              onChange={(e) => set("desmos_api_key", e.target.value)}
              placeholder="dcb31709b452b1cf9dc26972add0fda6"
              className={INPUT}
            />
          )}
        </Field>
        <Actions
          onSave={() => save("desmos", ["desmos_api_key"])}
          saving={savingCard === "desmos"}
          saved={savedCard === "desmos"}
          disabled={loading}
          hint={
            !settings.desmos_api_key.trim() ? "Leave empty to disable the calculator." : undefined
          }
        />
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card
        icon={Sparkles}
        title="Beyond AI models"
        description={
          <>
            Each task routes to its own model. Chat, quick, and reasoning use OpenRouter; vision
            uses the Gemini API directly. Leave a field empty to use the built-in default. Browse
            OpenRouter IDs at{" "}
            <a
              href="https://openrouter.ai/models"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-white underline"
            >
              openrouter.ai/models
            </a>
            . Free-tier models are rate-limited and can be withdrawn without notice — if Beyond AI
            stops answering, swapping the ID here fixes it without a redeploy.
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Fast chat & quiz generation"
            hint="Tutor replies and generated questions. Optimised for speed."
          >
            {loading ? (
              <InputSkeleton />
            ) : (
              <input
                value={settings.openrouter_model_chat}
                onChange={(e) => set("openrouter_model_chat", e.target.value)}
                placeholder={MODEL_DEFAULTS.openrouter_model_chat}
                className={INPUT}
              />
            )}
          </Field>
          <Field
            label="Quick dashboard answers"
            hint="The Focus panel on the dashboard. Pick the smallest model you can — this one is on the critical path of the first screen a student sees."
          >
            {loading ? (
              <InputSkeleton />
            ) : (
              <input
                value={settings.openrouter_model_quick}
                onChange={(e) => set("openrouter_model_quick", e.target.value)}
                placeholder={MODEL_DEFAULTS.openrouter_model_quick}
                className={INPUT}
              />
            )}
          </Field>
          <Field
            label="Deep diagnostics & reasoning"
            hint="Step-by-step maths breakdowns on the Analysis page."
          >
            {loading ? (
              <InputSkeleton />
            ) : (
              <input
                value={settings.openrouter_model_reasoning}
                onChange={(e) => set("openrouter_model_reasoning", e.target.value)}
                placeholder={MODEL_DEFAULTS.openrouter_model_reasoning}
                className={INPUT}
              />
            )}
          </Field>
          <Field
            label="Image recognition (internal)"
            hint="Gemini model that reads chat attachments before your chosen model answers. Not shown in the student picker."
          >
            {loading ? (
              <InputSkeleton />
            ) : (
              <input
                value={settings.openrouter_model_vision}
                onChange={(e) => set("openrouter_model_vision", e.target.value)}
                placeholder={MODEL_DEFAULTS.openrouter_model_vision}
                className={INPUT}
              />
            )}
          </Field>
        </div>

        {/* The API key is deliberately not editable here. Storing it in
            app_settings would send it to the browser on this very page. */}
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-brand-800 p-4 ring-1 ring-brand-400/40">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
          <div className="min-w-0 text-xs text-brand-100">
            <div className="font-bold text-white">The API key isn't set here.</div>
            <p className="mt-1">
              It's a Cloudflare Worker secret, so it never reaches the browser or the database. Set
              or rotate it from a terminal, in the project directory:
            </p>
            {/* `npx` matters: wrangler is a devDependency here, not a global
                install, so a bare `wrangler` resolves to a global path that
                doesn't exist and fails with "Cannot find module". */}
            <code className="mt-2 block overflow-x-auto rounded-lg bg-brand-900/60 px-3 py-2 font-mono text-[11px] text-white">
              npx wrangler secret put OPENROUTER_API_KEY
            </code>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-brand-900/60 px-3 py-2 font-mono text-[11px] text-white">
              npx wrangler secret put GEMINI_API_KEY
            </code>
          </div>
        </div>

        <Actions
          onSave={() =>
            save("models", [
              "openrouter_model_chat",
              "openrouter_model_quick",
              "openrouter_model_reasoning",
              "openrouter_model_vision",
            ])
          }
          saving={savingCard === "models"}
          saved={savedCard === "models"}
          disabled={loading}
        />
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card
        icon={Wrench}
        title="Maintenance mode"
        description="Show a maintenance page to every visitor while you work. Admins keep full access, and the sign-in page stays reachable so you can't lock yourself out."
      >
        <div className="flex items-center justify-between gap-4 rounded-xl bg-brand-800 p-4 ring-1 ring-brand-400/40">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">
              {maintenanceOn ? "The site is in maintenance mode" : "The site is live"}
            </div>
            <p className="mt-0.5 text-xs text-brand-100">
              {maintenanceOn
                ? "Visitors see the maintenance page. You still see the real site."
                : "Everyone can reach the site normally."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={maintenanceOn}
            aria-label="Maintenance mode"
            disabled={loading || savingCard === "maintenance"}
            onClick={() => {
              const next = maintenanceOn ? "false" : "true";
              set("maintenance_enabled", next);
              /* Saved immediately rather than behind the Save button: a toggle
                 that looks flipped but isn't live is how a site stays down by
                 accident. The message field still saves explicitly. */
              save("maintenance", ["maintenance_enabled", "maintenance_message"], {
                maintenance_enabled: next,
              });
            }}
            className={
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 " +
              (maintenanceOn ? "bg-white" : "bg-brand-900 ring-1 ring-brand-400/50")
            }
          >
            <span
              className={
                "inline-block h-5 w-5 rounded-full transition-transform " +
                (maintenanceOn ? "translate-x-6 bg-brand-600" : "translate-x-1 bg-brand-200")
              }
            />
          </button>
        </div>

        <div className="mt-4">
          <Field label="Message shown to visitors" hint="Leave empty to use the default wording.">
            {loading ? (
              <InputSkeleton className="h-20" />
            ) : (
              <textarea
                value={settings.maintenance_message}
                onChange={(e) => set("maintenance_message", e.target.value)}
                rows={3}
                placeholder="Beyond SAT is undergoing scheduled updates to prepare for the upcoming Digital SAT test date."
                className={INPUT + " resize-y"}
              />
            )}
          </Field>
        </div>

        <Actions
          onSave={() => save("maintenance", ["maintenance_enabled", "maintenance_message"])}
          saving={savingCard === "maintenance"}
          saved={savedCard === "maintenance"}
          disabled={loading}
          hint="Changes take up to 30 seconds to reach every visitor."
        />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Local presentation pieces. Kept in this file because they encode this page's
   card layout specifically — the app-wide surface primitive is <Panel>, which
   these deliberately don't use so the settings form can keep its own header
   shape with the leading icon tile.
   --------------------------------------------------------------------------- */

const INPUT =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm font-mono text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-6 shadow-panel rise-in">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-brand-400 grid place-items-center text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-black text-white">{title}</div>
          <p className="text-sm text-brand-100 mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-brand-100 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-brand-200">{hint}</p>}
    </div>
  );
}

function InputSkeleton({ className = "h-10" }: { className?: string }) {
  return <div className={`rounded-lg bg-brand-800 ring-1 ring-brand-400/40 ${className}`} />;
}

function Actions({
  onSave,
  saving,
  saved,
  disabled,
  hint,
}: {
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save
      </button>
      {saved && <span className="pop-in text-xs font-bold text-white">Saved.</span>}
      {hint && !saved && <span className="text-xs text-brand-200">{hint}</span>}
    </div>
  );
}
