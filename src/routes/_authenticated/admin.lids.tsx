import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, GripVertical, Pencil, Plus, Save, School, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { createClass } from "@/lib/classes";
import { LID_COLUMNS, deleteLid, listLids, loadLidsFormUrl, saveLid, saveLidsFormUrl, setLidStatus, type Lid, type LidStatus } from "@/lib/lids";
import { safeNavigationUrl } from "@/lib/safe-url";

export const Route = createFileRoute("/_authenticated/admin/lids")({
  component: AdminLids,
  head: () => ({ meta: [{ title: "Lids — Admin" }] }),
});

const blank = { fullName: "", phone: "", wantedClass: "", note: "" };

function AdminLids() {
  const [rows, setRows] = useState<Lid[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [formUrl, setFormUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState<LidStatus | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState(blank);

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

  async function move(id: string, status: LidStatus) {
    const card = rows.find((row) => row.id === id);
    if (!card || card.status === status) return;
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)));
    try {
      await setLidStatus(id, status);
    } catch (err) {
      setRows(previous);
      toast.error(err instanceof Error ? err.message : "Could not move");
    }
  }

  async function remove(card: Lid) {
    if (!confirm(`Delete ${card.full_name}?`)) return;
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== card.id));
    try {
      await deleteLid(card.id);
      toast.success("Demand deleted");
    } catch (err) {
      setRows(previous);
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  function startEdit(card: Lid) {
    setEditingId(card.id);
    setEdit({
      fullName: card.full_name,
      phone: card.phone,
      wantedClass: card.wanted_class,
      note: card.note ?? "",
    });
  }

  async function saveEdit(id: string) {
    setBusy(true);
    try {
      await saveLid({ id, ...edit });
      setEditingId(null);
      toast.success("Demand updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

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
          <p className="mt-1 text-sm text-brand-700">Demands for a new group. Drag a card into another column, or delete it.</p>
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
            <section
              key={column.status}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOver(column.status);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setOver((current) => (current === column.status ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                const id = event.dataTransfer.getData("text/plain");
                if (id) void move(id, column.status);
              }}
              className={
                "min-h-[420px] rounded-2xl bg-slate-100 p-3 " +
                (over === column.status ? "ring-2 ring-brand-400" : "")
              }
            >
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
                  const editing = editingId === card.id;
                  return (
                    <li
                      key={card.id}
                      draggable={!editing}
                      onDragStart={(event) => {
                        if ((event.target as HTMLElement).closest("button, input")) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.setData("text/plain", card.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setOver(null)}
                      className={
                        "rounded-xl bg-white p-3 text-sm shadow-sm " +
                        (editing ? "" : "cursor-grab active:cursor-grabbing")
                      }
                    >
                      {editing ? (
                        <form
                          className="space-y-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveEdit(card.id);
                          }}
                        >
                          <input required aria-label="Name" placeholder="Name" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                          <input required aria-label="Phone" placeholder="Phone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                          <input required aria-label="Class" placeholder="Class they want" value={edit.wantedClass} onChange={(e) => setEdit({ ...edit, wantedClass: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                          <input aria-label="Note" placeholder="Note" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                          <div className="flex gap-2">
                            <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">
                              <Save className="h-3.5 w-3.5" aria-hidden="true" /> Save
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
                              <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-start gap-2">
                          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold">{card.full_name}</p>
                            <p className="text-xs text-slate-500">{card.phone}</p>
                            <p className="mt-1 text-xs font-semibold text-brand-700">{card.wanted_class}</p>
                            {card.note && <p className="mt-1 text-xs text-slate-600">{card.note}</p>}
                          </div>
                          <button
                            type="button"
                            aria-label={`Edit ${card.full_name}`}
                            onClick={() => startEdit(card)}
                            className="inline-flex rounded-lg p-1 text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${card.full_name}`}
                            onClick={() => void remove(card)}
                            className="inline-flex rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
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
