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
  MonitorSmartphone,
  Bot,
  GraduationCap,
  Star,
  Gift,
} from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeletons";

/** Shared control styling for every field in the section editors. */
const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

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
  showcase: {
    label: "Dashboard showcase",
    icon: MonitorSmartphone,
    description: "The dashboard preview graphic with an optional heading.",
    template: {
      title: "Everything in one place",
      subtitle: "Your scores, your weak spots, your next step.",
    },
  },
  ai_demo: {
    label: "Beyond AI demo",
    icon: Bot,
    description: "A feature block with bullets beside a scripted AI conversation.",
    template: {
      eyebrow: "Beyond AI",
      title: "Your personal 1-on-1 Digital SAT coach",
      subtitle: "Ask anything. Get a worked solution, not just an answer.",
      items: [{ text: "Step-by-step explanations for every question" }],
      button_label: "Try Beyond AI",
      button_href: "/signup",
      chat_title: "Beyond AI",
      messages: [
        { role: "user", text: "Why is the answer B?" },
        { role: "assistant", text: "Because $2x + 3 = 9$ gives $x = 3$." },
      ],
    },
  },
  programs: {
    label: "Programs",
    icon: GraduationCap,
    description: "Cards for each prep program, with a duration and a button.",
    template: {
      title: "Choose your program",
      subtitle: "",
      items: [
        {
          icon: "GraduationCap",
          title: "Program name",
          duration: "8 weeks",
          description: "Describe the program.",
          button_label: "Learn more",
          button_href: "/signup",
        },
      ],
    },
  },
  reviews: {
    label: "Student reviews",
    icon: Star,
    description: "Testimonial cards with a star rating and a name.",
    template: {
      title: "What students say",
      subtitle: "",
      items: [
        { stars: 5, quote: "Write the testimonial here.", name: "Student name", detail: "1520 · +180 points", avatar: "" },
      ],
    },
  },
  /**
   * Replaces the old "Pricing table" kind. Beyond SAT has no paid plan, so a
   * tier grid advertised a product that doesn't exist — and a column labelled
   * "Free" implies the others cost money. This is one unambiguous statement
   * with a feature list instead.
   */
  free: {
    label: "Free banner",
    icon: Gift,
    description: "A single band stating the platform is free, with a feature list.",
    template: {
      eyebrow: "Free forever",
      title: "Everything here is free",
      subtitle: "No subscription, no paywall, no locked questions. Make an account and start.",
      items: [{ text: "What's included" }],
      button_label: "Create a free account",
      button_href: "/signup",
      footnote: "No card required.",
    },
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

  if (loading) return <ListSkeleton rows={5} />;

  return (
    <div className="space-y-6">

      <div className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-brand-100">
              Add a new section
            </label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              className={CONTROL_CLASS}
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
            className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
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
          <div
            key={s.id}
            className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-400 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{meta.label}</div>
                <div className="text-xs text-brand-100">{meta.description}</div>
              </div>
              {/* "Hidden" was orange; it reads as a recessed chip with a light ring. */}
              {!s.visible && (
                <span className="ml-2 rounded-full bg-brand-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-brand-300/60">
                  Hidden
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => move(s, -1)}
                  disabled={idx === 0}
                  className="tap grid h-8 w-8 place-items-center rounded-lg border border-brand-400/50 text-brand-100 hover:bg-brand-800 hover:text-white disabled:opacity-40"
                  aria-label="Move up"
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(s, 1)}
                  disabled={idx === sections.length - 1}
                  className="tap grid h-8 w-8 place-items-center rounded-lg border border-brand-400/50 text-brand-100 hover:bg-brand-800 hover:text-white disabled:opacity-40"
                  aria-label="Move down"
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleVisible(s)}
                  className="tap inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-400/50 px-3 text-xs font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
                  title={s.visible ? "Click to hide" : "Click to show"}
                >
                  {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {s.visible ? "Visible" : "Hidden"}
                </button>
                <button
                  onClick={() => remove(s)}
                  className="tap grid h-8 w-8 place-items-center rounded-lg border border-brand-400/50 text-brand-100 hover:bg-brand-900 hover:text-white"
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
              {/* The confirmation was green; on-palette it's simply light copy. */}
              {savedFlash === s.id && (
                <span className="fade-in text-xs font-semibold text-white">Saved ✓</span>
              )}
              <button
                onClick={() => saveSection(s)}
                disabled={saving === s.id || !isDirty}
                className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-100">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-brand-100">{hint}</div>}
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
      className={CONTROL_CLASS}
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
      className={CONTROL_CLASS}
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
      className={CONTROL_CLASS}
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

  if (kind === "showcase") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title (optional)" hint="Leave both blank to show just the graphic."><TextInput value={value.title} onChange={set("title")} /></Field>
        <Field label="Subtitle (optional)"><TextInput value={value.subtitle} onChange={set("subtitle")} /></Field>
      </div>
    );
  }

  if (kind === "ai_demo") {
    /* The scripted transcript is a second list alongside `items`, so it can't
       reuse the updateItem/addItem helpers above — those are hard-wired to
       `items`. These three are the same operations against `messages`. */
    const messages: any[] = Array.isArray(value.messages) ? value.messages : [];
    const updateMessage = (i: number, patch: any) =>
      onChange((prev) => {
        const next = [...(prev.messages ?? [])];
        next[i] = { ...next[i], ...patch };
        return { ...prev, messages: next };
      });
    const addMessage = (role: string) =>
      onChange((prev) => ({
        ...prev,
        messages: [...(prev.messages ?? []), { role, text: "" }],
      }));
    const removeMessage = (i: number) =>
      onChange((prev) => {
        const next = [...(prev.messages ?? [])];
        next.splice(i, 1);
        return { ...prev, messages: next };
      });
    const moveMessage = (i: number, dir: -1 | 1) =>
      onChange((prev) => {
        const next = [...(prev.messages ?? [])];
        const j = i + dir;
        if (j < 0 || j >= next.length) return prev;
        [next[i], next[j]] = [next[j], next[i]];
        return { ...prev, messages: next };
      });

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow" hint="Small label above the title."><TextInput value={value.eyebrow} onChange={set("eyebrow")} placeholder="Beyond AI" /></Field>
          <Field label="Title"><TextInput value={value.title} onChange={set("title")} /></Field>
          <div className="md:col-span-2">
            <Field label="Subtitle"><TextArea value={value.subtitle} onChange={set("subtitle")} rows={2} /></Field>
          </div>
          <Field label="Button text"><TextInput value={value.button_label} onChange={set("button_label")} /></Field>
          <Field label="Button link"><TextInput value={value.button_href} onChange={set("button_href")} placeholder="/signup" /></Field>
        </div>

        <SubHeading label="Bullet points" />
        <div className="space-y-3">
          {items.map((it, i) => (
            <ItemRow key={i} index={i} count={items.length} onMove={(dir) => moveItem(i, dir)} onRemove={() => removeItem(i)}>
              <Field label="Bullet text"><TextInput value={it.text} onChange={(v) => updateItem(i, { text: v })} /></Field>
            </ItemRow>
          ))}
          <AddItemButton label="Add a bullet" onClick={() => addItem({ text: "" })} />
        </div>

        <SubHeading label="Example conversation" />
        <Field label="Chat header"><TextInput value={value.chat_title} onChange={set("chat_title")} placeholder="Beyond AI" /></Field>
        <div className="space-y-3">
          {messages.map((m, i) => (
            <ItemRow key={i} index={i} count={messages.length} onMove={(dir) => moveMessage(i, dir)} onRemove={() => removeMessage(i)}>
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Who's speaking">
                  <select
                    value={m.role ?? "user"}
                    onChange={(e) => updateMessage(i, { role: e.target.value })}
                    className={CONTROL_CLASS}
                  >
                    <option value="user">Student</option>
                    <option value="assistant">Beyond AI</option>
                  </select>
                </Field>
                <div className="md:col-span-3">
                  {/* Maths is written the same way as in questions, so an admin
                      who has entered a question already knows this syntax. */}
                  <Field label="Message" hint="Maths goes in dollar signs, e.g. $2x + 3 = 9$.">
                    <TextArea value={m.text} onChange={(v) => updateMessage(i, { text: v })} rows={2} />
                  </Field>
                </div>
              </div>
            </ItemRow>
          ))}
          <div className="flex flex-wrap gap-2">
            <AddItemButton label="Add a student message" onClick={() => addMessage("user")} />
            <AddItemButton label="Add a Beyond AI reply" onClick={() => addMessage("assistant")} />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "programs") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Section title"><TextInput value={value.title} onChange={set("title")} /></Field>
          <Field label="Section subtitle"><TextInput value={value.subtitle} onChange={set("subtitle")} /></Field>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <ItemRow key={i} index={i} count={items.length} onMove={(dir) => moveItem(i, dir)} onRemove={() => removeItem(i)}>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Program name"><TextInput value={it.title} onChange={(v) => updateItem(i, { title: v })} /></Field>
                <Field label="Duration" hint="Shown under the name."><TextInput value={it.duration} onChange={(v) => updateItem(i, { duration: v })} placeholder="8 weeks" /></Field>
                <Field label="Icon name" hint="Any Lucide icon name."><TextInput value={it.icon} onChange={(v) => updateItem(i, { icon: v })} placeholder="GraduationCap" /></Field>
                <div className="md:col-span-3">
                  <Field label="Description"><TextArea value={it.description} onChange={(v) => updateItem(i, { description: v })} rows={2} /></Field>
                </div>
                <Field label="Button text (optional)"><TextInput value={it.button_label} onChange={(v) => updateItem(i, { button_label: v })} /></Field>
                <Field label="Button link"><TextInput value={it.button_href} onChange={(v) => updateItem(i, { button_href: v })} placeholder="/signup" /></Field>
              </div>
            </ItemRow>
          ))}
          <AddItemButton
            label="Add a program"
            onClick={() => addItem({ icon: "GraduationCap", title: "New program", duration: "", description: "", button_label: "Learn more", button_href: "/signup" })}
          />
        </div>
      </div>
    );
  }

  if (kind === "reviews") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Section title"><TextInput value={value.title} onChange={set("title")} /></Field>
          <Field label="Section subtitle"><TextInput value={value.subtitle} onChange={set("subtitle")} /></Field>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <ItemRow key={i} index={i} count={items.length} onMove={(dir) => moveItem(i, dir)} onRemove={() => removeItem(i)}>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Student name"><TextInput value={it.name} onChange={(v) => updateItem(i, { name: v })} /></Field>
                <Field label="Detail" hint="Score, school, anything short."><TextInput value={it.detail} onChange={(v) => updateItem(i, { detail: v })} placeholder="1520 · +180 points" /></Field>
                <Field label="Stars" hint="0 to 5."><NumberInput value={it.stars} onChange={(v) => updateItem(i, { stars: v })} placeholder="5" /></Field>
                <div className="md:col-span-3">
                  <Field label="Quote" hint="Quotation marks are added automatically."><TextArea value={it.quote} onChange={(v) => updateItem(i, { quote: v })} rows={3} /></Field>
                </div>
                <div className="md:col-span-3">
                  <Field label="Photo URL (optional)" hint="Leave blank to show their initials instead."><TextInput value={it.avatar} onChange={(v) => updateItem(i, { avatar: v })} /></Field>
                </div>
              </div>
            </ItemRow>
          ))}
          <AddItemButton
            label="Add a review"
            onClick={() => addItem({ stars: 5, quote: "", name: "", detail: "", avatar: "" })}
          />
        </div>
      </div>
    );
  }

  if (kind === "free") {
    /* One flat list of short strings, so it's a textarea rather than ItemRows —
       a box-per-bullet for four words each is more chrome than content. */
    const featuresText = items
      .map((f: any) => (typeof f === "string" ? f : (f?.text ?? "")))
      .join("\n");

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow" hint="Small label above the heading.">
            <TextInput value={value.eyebrow} onChange={set("eyebrow")} placeholder="Free forever" />
          </Field>
          <Field label="Heading">
            <TextInput value={value.title} onChange={set("title")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Subtitle"><TextInput value={value.subtitle} onChange={set("subtitle")} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="What's included" hint="One per line. Shown as a two-column tick list.">
              <TextArea
                value={featuresText}
                onChange={(v) =>
                  // Blank lines are dropped so a trailing newline doesn't render
                  // an empty bullet with a tick beside it.
                  onChange((prev: any) => ({
                    ...prev,
                    items: v
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((text) => ({ text })),
                  }))
                }
                rows={6}
              />
            </Field>
          </div>
          <Field label="Button text">
            <TextInput value={value.button_label} onChange={set("button_label")} placeholder="Create a free account" />
          </Field>
          <Field label="Button link">
            <TextInput value={value.button_href} onChange={set("button_href")} placeholder="/signup" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Footnote (optional)" hint="Small print under the button.">
              <TextInput value={value.footnote} onChange={set("footnote")} placeholder="No card required." />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  // fallback: unknown kind
  return (
    <div className="rounded-lg border border-dashed border-brand-300/50 p-4 text-sm text-brand-100">
      This section type doesn't have a friendly editor yet.
    </div>
  );
}

/** Divider label for editors that hold more than one list. */
function SubHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-bold uppercase tracking-wider text-brand-200">{label}</span>
      <span className="h-px flex-1 bg-brand-400/40" />
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
  // One step down from the card so the brand-800 inputs nested inside still
  // read as recessed rather than merging into the row.
  return (
    <div className="rounded-xl border border-brand-400/40 bg-brand-700 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-200">Item {index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="tap grid h-7 w-7 place-items-center rounded-md border border-brand-400/50 text-brand-100 hover:bg-brand-900 hover:text-white disabled:opacity-40"
            aria-label="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="tap grid h-7 w-7 place-items-center rounded-md border border-brand-400/50 text-brand-100 hover:bg-brand-900 hover:text-white disabled:opacity-40"
            aria-label="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="tap grid h-7 w-7 place-items-center rounded-md border border-brand-400/50 text-brand-100 hover:bg-brand-900 hover:text-white"
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
      className="tap inline-flex items-center gap-2 rounded-lg border border-dashed border-brand-300/50 px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}
