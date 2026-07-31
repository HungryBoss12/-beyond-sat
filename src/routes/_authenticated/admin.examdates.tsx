import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";

type ExamDate = {
  id: string;
  exam_date: string;
  label: string | null;
  active: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/examdates")({
  component: AdminExamDates,
});

function AdminExamDates() {
  const [items, setItems] = useState<ExamDate[] | null>(null);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("exam_dates")
      .select("*")
      .order("exam_date", { ascending: true });
    setItems((data ?? []) as ExamDate[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("exam_dates")
      .insert({ exam_date: date, label: label || null, active: true });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDate("");
    setLabel("");
    load();
  }

  async function toggle(row: ExamDate) {
    await supabase.from("exam_dates").update({ active: !row.active }).eq("id", row.id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Remove this exam date?")) return;
    await supabase.from("exam_dates").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={add}
        className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end"
      >
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-100 mb-1">
            Exam date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-brand-200 focus:outline-none"
            required
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-100 mb-1">
            Label (optional)
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. March SAT"
            className="block w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
          />
        </label>
        <button
          disabled={saving}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add date
        </button>
        {/* Errors read as a darker inset chip with a light ring rather than red. */}
        {err && (
          <div className="md:col-span-3 rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
            {err}
          </div>
        )}
      </form>

      {items === null ? (
        <ListSkeleton rows={5} />
      ) : (
        <div className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">
              No exam dates yet. Add the official SAT dates students can pick from.
            </div>
          ) : (
            <ul className="divide-y divide-brand-400/30">
              {items.map((d) => (
                <li key={d.id} className="flex items-center gap-4 px-4 py-3">
                  <CalendarDays className="h-5 w-5 shrink-0 text-brand-200" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">
                      {format(new Date(d.exam_date), "EEEE, MMMM d, yyyy")}
                    </div>
                    {d.label && <div className="text-xs text-brand-100">{d.label}</div>}
                  </div>
                  {/* Active vs hidden reads through the ramp's lightness, not hue. */}
                  <button
                    onClick={() => toggle(d)}
                    className={
                      "tap rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider " +
                      (d.active
                        ? "bg-brand-400 text-white"
                        : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40")
                    }
                  >
                    {d.active ? "Active" : "Hidden"}
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="tap rounded-lg h-8 w-8 grid place-items-center text-brand-100 hover:bg-brand-800 hover:text-white"
                    aria-label="Remove exam date"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
