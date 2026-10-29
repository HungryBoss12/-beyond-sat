import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Plus, Save, School, Users } from "lucide-react";
import { toast } from "sonner";
import { createClass } from "@/lib/classes";
import { LID_COLUMNS, listLids, loadLidsFormUrl, saveLid, saveLidsFormUrl, setLidStatus, type Lid, type LidStatus } from "@/lib/lids";
import { safeNavigationUrl } from "@/lib/safe-url";

export const Route = createFileRoute("/_authenticated/admin/lids")({
  component: AdminLids,
  head: () => ({ meta: [{ title: "Lids — Admin" }] }),
});

const blank = { fullName: "", phone: "", wantedClass: "", note: "" };
const NEXT: Partial<Record<LidStatus, LidStatus>> = {
  inquiry: "contact",
  contact: "in_progress",
  in_progress: "enrolled",
};

function AdminLids() {
  const [rows, setRows] = useState<Lid[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [formUrl, setFormUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [lids, url] = await Promise.all([listLids(), loadLidsFormUrl().catch(() => "")]);
    setRows(lids);
    setFormUrl(url);
  }

  useEffect(() => {
    void load().catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load lids"));
  }, []);

  const byStatus = useMemo(() => {
    const map = new Map<LidStatus, Lid[]>();
    for (const column of LID_COLUMNS) map.set(column.status, []);
    for (const row of rows) {
      const list = map.get(row.status) ?? [];
      list.push(row);
      map.set(row.status, list);
    }
    return map;
  }, [rows]);

  const formHref = safeNavigationUrl(formUrl);
  const formLink = formHref && /^https?:/i.test(formHref) ? formHref : null;

  const demands = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.status === "enrolled") continue;
      const key = row.wanted_class.trim();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  async function add() {
    setBusy(true);
    try {
      await saveLid(draft);
      setDraft(blank);
      setAdding(false);
      toast.success("Demand added");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-brand-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight">
            <Users className="h-7 w-7" aria-hidden="true" /> Lids
          </h1>
          <p className="mt-1 text-sm text-brand-700">Demands for a new group. Move a card as you contact them.</p>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveLidsFormUrl(formUrl)
              .then(() => toast.success("Form link saved"))
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not save the link"));
          }}
        >
          <input
            aria-label="Google Form link"
            placeholder="Google Form link"
            value={formUrl}
            onChange={(event) => setFormUrl(event.target.value)}
            className="w-64 rounded-lg border border-brand-400/40 px-3 py-2 text-sm"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-xs font-bold text-white">
            <Save className="h-3.5 w-3.5" aria-hidden="true" /> Save link
          </button>
          {formLink && (
            <a href={formLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open form
            </a>
          )}
        </form>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {LID_COLUMNS.map((column) => {
          const cards = byStatus.get(column.status) ?? [];
          return (
            <section key={column.status} className="min-h-[420px] rounded-2xl bg-slate-100 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-brand-800">
                  {column.label} ({cards.length})
                </h2>
                {column.status === "inquiry" && (
                  <button
                    type="button"
                    onClick={() => setAdding((open) => !open)}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-400 px-2 py-1 text-xs font-bold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Qo'shish
                  </button>
                )}
              </div>
              {column.status === "inquiry" && adding && (
                <form
                  className="widen-in mb-3 space-y-2 rounded-xl bg-white p-3 shadow-sm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void add();
                  }}
                >
                  <input required aria-label="Name" placeholder="Name" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <input required aria-label="Phone" placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <input required aria-label="Class" placeholder="Class they want" value={draft.wantedClass} onChange={(e) => setDraft({ ...draft, wantedClass: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <input aria-label="Note" placeholder="Note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
                  </button>
                </form>
              )}
              <ul className="space-y-2">
                {cards.map((card) => {
                  const next = NEXT[card.status];
                  return (
                    <li key={card.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                      <p className="font-bold">{card.full_name}</p>
                      <p className="text-xs text-slate-500">{card.phone}</p>
                      <p className="mt-1 text-xs font-semibold text-brand-700">{card.wanted_class}</p>
                      {card.note && <p className="mt-1 text-xs text-slate-600">{card.note}</p>}
                      {next && (
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-700"
                          onClick={() => {
                            void setLidStatus(card.id, next)
                              .then(load)
                              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not move"));
                          }}
                        >
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> Move
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {demands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {demands.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white"
              onClick={() => {
                void createClass({ name })
                  .then(() => toast.success(`${name} opened`))
                  .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not open the class"));
              }}
            >
              <School className="h-3.5 w-3.5" aria-hidden="true" /> {name} · {count} demand{count === 1 ? "" : "s"} · Open
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
