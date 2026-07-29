import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Save,
  Sparkles,
  BarChart3,
  LayoutGrid,
  ListOrdered,
  Megaphone,
  FileText,
  Newspaper,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/homepage")({
  component: AdminHomepage,
  head: () => ({ meta: [{ title: "Homepage — Admin" }] }),
});

type Section = {
  id: string;
  kind: string;
  position: number;
  visible: boolean;
  data: any;
};

const KIND_META: Record<
  string,
  { label: string; icon: any; description: string; template: any }
> = {
  hero: {
    label: "Hero banner",
    icon: Sparkles,
    description: "The big headline area at the top of the page.",
    template: {
      title: "Headline here",
      highlight: "",
      subtitle: "Supporting subheadline",
      primary_cta_label: "Get started",
      primary_cta_href: "/signup",
      secondary_cta_label: "Sign in",
      secondary_cta_href: "/signin",
    },
  },
  stats: {
    label: "Stats row",
    icon: BarChart3,
    description: "A row of numbers to show off results.",
    template: { items: [{ n: 100, s: "%", l: "Describe this stat", icon: "Target" }] },
  },
  press: {
    label: "Press / logo bar",
    icon: Newspaper,
    description: "A \"Featured in\" strip of publication names.",
    template: {
      label: "Featured in",
      items: [{ name: "Forbes" }],
    },
  },
  features: {
    label: "Features grid",
    icon: LayoutGrid,
    description: "A grid of feature cards with a title and description each.",
    template: {
      title: "Section title",
      subtitle: "Section subtitle",
      items: [{ icon: "GraduationCap", title: "Feature", description: "Describe the feature." }],
    },
  },
  how: {
    label: "How it works",
    icon: ListOrdered,
    description: "A numbered list of steps.",
    template: {
      title: "How it works",
      items: [{ n: "1", title: "Step", description: "Step description." }],
    },
  },
  cta: {
    label: "Call to action",
    icon: Megaphone,
    description: "A banner with a title and a single button.",
    template: { title: "Call to action", button_label: "Sign up", button_href: "/signup" },
  },
  custom: {
    label: "Custom block",
    icon: FileText,
    description: "A free-form block with a title, body text, and optional button.",
    template: { title: "Custom title", body: "Write anything here.", button_label: "", button_href: "" },
  },
};

const KIND_OPTIONS = Object.entries(KIND_META).map(([value, m]) => ({
  value,
  label: m.label,
  description: m.description,
}));

function AdminHomepage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [newKind, setNewKind] = useState("custom");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("homepage_sections")
      .select("*")
      .order("position", { ascending: true });
    if (!error && data) {
      setSections(data as Section[]);
      const d: Record<string, any> = {};
      (data as Section[]).forEach((s) => (d[s.id] = structuredClone(s.data ?? {})));
      setDrafts(d);
      setDirty({});
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function updateDraft(id: string, updater: (prev: any) => any) {
    setDrafts((d) => ({ ...d, [id]: updater(d[id] ?? {}) }));
    setDirty((x) => ({ ...x, [id]: true }));
  }

  async function saveSection(s: Section) {
    setSaving(s.id);
    await supabase.from("homepage_sections").update({ data: drafts[s.id] }).eq("id", s.id);
    setSaving(null);
    setDirty((x) => ({ ...x, [s.id]: false }));
    setSavedFlash(s.id);
    setTimeout(() => setSavedFlash((v) => (v === s.id ? null : v)), 1600);
  }

  async function toggleVisible(s: Section) {
    await supabase.from("homepage_sections").update({ visible: !s.visible }).eq("id", s.id);
    load();
  }

  async function remove(s: Section) {
    if (!confirm("Delete this section? This cannot be undone.")) return;
    await supabase.from("homepage_sections").delete().eq("id", s.id);
    load();
  }

  async function move(s: Section, dir: -1 | 1) {
    const idx = sections.findIndex((x) => x.id === s.id);
    const other = sections[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from("homepage_sections").update({ position: other.position }).eq("id", s.id),
      supabase.from("homepage_sections").update({ position: s.position }).eq("id", other.id),
    ]);
    load();
  }

  async function addSection() {
    const tpl = KIND_META[newKind];
    const maxPos = sections.reduce((m, s) => Math.max(m, s.position), 0);
    await supabase.from("homepage_sections").insert({
      kind: newKind,
      position: maxPos + 10,
      visible: true,
      data: tpl?.template ?? {},
    });
    load();
  }

  if (loading) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">

      <div className="rounded-2xl border border-border bg-white p-5 soft-shadow">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Add a new section
            </label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label} — {k.description}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addSection}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>
      </div>

      {sections.map((s, idx) => {
        const meta = KIND_META[s.kind] ?? KIND_META.custom;
        const Icon = meta.icon;
        const isDirty = !!dirty[s.id];
        return (
          <div key={s.id} className="rounded-2xl border border-border bg-white p-5 soft-shadow">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">{meta.label}</div>
                <div className="text-xs text-slate-500">{meta.description}</div>
              </div>
              {!s.visible && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 uppercase tracking-wider">
                  Hidden
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => move(s, -1)}
                  disabled={idx === 0}
                  className="h-8 w-8 grid place-items-center rounded-lg border border-border text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Move up"
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(s, 1)}
                  disabled={idx === sections.length - 1}
                  className="h-8 w-8 grid place-items-center rounded-lg border border-border text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Move down"
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleVisible(s)}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  title={s.visible ? "Click to hide" : "Click to show"}
                >
                  {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {s.visible ? "Visible" : "Hidden"}
                </button>
                <button
                  onClick={() => remove(s)}
                  className="h-8 w-8 grid place-items-center rounded-lg border border-border text-rose-600 hover:bg-rose-50"
                  aria-label="Delete section"
                  title="Delete section"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <SectionEditor
              kind={s.kind}
              value={drafts[s.id] ?? {}}
              onChange={(fn) => updateDraft(s.id, fn)}
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              {savedFlash === s.id && (
                <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>
              )}
              <button
                onClick={() => saveSection(s)}
                disabled={saving === s.id || !isDirty}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {saving === s.id ? "Saving…" : isDirty ? "Save changes" : "Saved"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Field primitives ----------

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
    <label className="block">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: any;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: any;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: any;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

// ---------- Section editors ----------

type EditorProps = {
  kind: string;
  value: any;
  onChange: (updater: (prev: any) => any) => void;
};

function SectionEditor({ kind, value, onChange }: EditorProps) {
  const set = (key: string) => (v: any) => onChange((prev) => ({ ...prev, [key]: v }));
  const items: any[] = Array.isArray(value.items) ? value.items : [];

  function updateItem(i: number, patch: any) {
    onChange((prev) => {
      const next = [...(prev.items ?? [])];
      next[i] = { ...next[i], ...patch };
      return { ...prev, items: next };
    });
  }
  function addItem(tpl: any) {
    onChange((prev) => ({ ...prev, items: [...(prev.items ?? []), tpl] }));
  }
  function removeItem(i: number) {
    onChange((prev) => {
      const next = [...(prev.items ?? [])];
      next.splice(i, 1);
      return { ...prev, items: next };
    });
  }
  function moveItem(i: number, dir: -1 | 1) {
    onChange((prev) => {
      const next = [...(prev.items ?? [])];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, items: next };
    });
  }

  if (kind === "hero") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Headline"><TextInput value={value.title} onChange={set("title")} placeholder="Ace the SAT..." /></Field>
        <Field label="Highlighted words" hint="Part of the headline to show in the blue gradient, e.g. Digital SAT. Must match the headline exactly."><TextInput value={value.highlight} onChange={set("highlight")} placeholder="Digital SAT" /></Field>
        <Field label="Subheadline"><TextInput value={value.subtitle} onChange={set("subtitle")} placeholder="Supporting text" /></Field>
        <div />
        <Field label="Primary button text"><TextInput value={value.primary_cta_label} onChange={set("primary_cta_label")} placeholder="Get started" /></Field>
        <Field label="Primary button link" hint="e.g. /signup or https://…"><TextInput value={value.primary_cta_href} onChange={set("primary_cta_href")} placeholder="/signup" /></Field>
        <Field label="Secondary button text"><TextInput value={value.secondary_cta_label} onChange={set("secondary_cta_label")} placeholder="Sign in" /></Field>
        <Field label="Secondary button link"><TextInput value={value.secondary_cta_href} onChange={set("secondary_cta_href")} placeholder="/signin" /></Field>
      </div>
    );
  }

  if (kind === "press") {
    return (
      <div className="space-y-4">
        <Field label="Label" hint="Shown before the logos."><TextInput value={value.label} onChange={set("label")} placeholder="Featured in" /></Field>
        <div className="space-y-3">
          {items.map((it, i) => (
            <ItemRow key={i} index={i} count={items.length} onMove={(d) => moveItem(i, d)} onRemove={() => removeItem(i)}>
              <Field label="Publication name"><TextInput value={it.name} onChange={(v) => updateItem(i, { name: v })} placeholder="Forbes" /></Field>
            </ItemRow>
          ))}
          <AddItemButton label="Add a publication" onClick={() => addItem({ name: "Publication" })} />
        </div>
      </div>
    );
  }

  if (kind === "cta") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title"><TextInput value={value.title} onChange={set("title")} /></Field>
        <div />
        <Field label="Button text"><TextInput value={value.button_label} onChange={set("button_label")} /></Field>
        <Field label="Button link"><TextInput value={value.button_href} onChange={set("button_href")} placeholder="/signup" /></Field>
      </div>
    );
  }

  if (kind === "custom") {
    return (
      <div className="grid gap-4">
        <Field label="Title"><TextInput value={value.title} onChange={set("title")} /></Field>
        <Field label="Body text"><TextArea value={value.body} onChange={set("body")} rows={5} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Button text (optional)"><TextInput value={value.button_label} onChange={set("button_label")} /></Field>
          <Field label="Button link (optional)"><TextInput value={value.button_href} onChange={set("button_href")} /></Field>
        </div>
      </div>
    );
  }

  if (kind === "stats") {
    return (
      <div className="space-y-3">
        {items.map((it, i) => (
          <ItemRow key={i} index={i} count={items.length} onMove={(d) => moveItem(i, d)} onRemove={() => removeItem(i)}>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Number"><NumberInput value={it.n} onChange={(v) => updateItem(i, { n: v })} placeholder="98" /></Field>
              <Field label="Suffix" hint="e.g. %, +, k"><TextInput value={it.s} onChange={(v) => updateItem(i, { s: v })} placeholder="%" /></Field>
              <Field label="Icon name" hint="Any Lucide icon name, e.g. Target"><TextInput value={it.icon} onChange={(v) => updateItem(i, { icon: v })} placeholder="Target" /></Field>
              <Field label="Label"><TextInput value={it.l} onChange={(v) => updateItem(i, { l: v })} placeholder="Students improved" /></Field>
            </div>
          </ItemRow>
        ))}
        <AddItemButton label="Add a stat" onClick={() => addItem({ n: 0, s: "", l: "New stat", icon: "Target" })} />
      </div>
    );
  }

  if (kind === "features") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Section title"><TextInput value={value.title} onChange={set("title")} /></Field>
          <Field label="Section subtitle"><TextInput value={value.subtitle} onChange={set("subtitle")} /></Field>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <ItemRow key={i} index={i} count={items.length} onMove={(d) => moveItem(i, d)} onRemove={() => removeItem(i)}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Feature title"><TextInput value={it.title} onChange={(v) => updateItem(i, { title: v })} /></Field>
                <Field label="Icon name" hint="Any Lucide icon name, e.g. GraduationCap"><TextInput value={it.icon} onChange={(v) => updateItem(i, { icon: v })} /></Field>
                <div className="md:col-span-2">
                  <Field label="Description"><TextArea value={it.description} onChange={(v) => updateItem(i, { description: v })} rows={2} /></Field>
                </div>
              </div>
            </ItemRow>
          ))}
          <AddItemButton label="Add a feature" onClick={() => addItem({ icon: "Sparkles", title: "New feature", description: "Describe it." })} />
        </div>
      </div>
    );
  }

  if (kind === "how") {
    return (
      <div className="space-y-4">
        <Field label="Section title"><TextInput value={value.title} onChange={set("title")} /></Field>
        <div className="space-y-3">
          {items.map((it, i) => (
            <ItemRow key={i} index={i} count={items.length} onMove={(d) => moveItem(i, d)} onRemove={() => removeItem(i)}>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Step number"><TextInput value={it.n} onChange={(v) => updateItem(i, { n: v })} placeholder="1" /></Field>
                <div className="md:col-span-2">
                  <Field label="Step title"><TextInput value={it.title} onChange={(v) => updateItem(i, { title: v })} /></Field>
                </div>
                <div className="md:col-span-3">
                  <Field label="Description"><TextArea value={it.description} onChange={(v) => updateItem(i, { description: v })} rows={2} /></Field>
                </div>
              </div>
            </ItemRow>
          ))}
          <AddItemButton label="Add a step" onClick={() => addItem({ n: String(items.length + 1), title: "New step", description: "" })} />
        </div>
      </div>
    );
  }

  // fallback: unknown kind
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-slate-500">
      This section type doesn't have a friendly editor yet.
    </div>
  );
}

function ItemRow({
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-slate-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item {index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="h-7 w-7 grid place-items-center rounded-md border border-border bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="h-7 w-7 grid place-items-center rounded-md border border-border bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="h-7 w-7 grid place-items-center rounded-md border border-border bg-white text-rose-600 hover:bg-rose-50"
            aria-label="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function AddItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}
