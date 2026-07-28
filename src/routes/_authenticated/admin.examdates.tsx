import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

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
  const [items, setItems] = useState<ExamDate[]>([]);
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
        className="rounded-2xl border border-border bg-white p-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end"
      >
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Exam date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Label (optional)
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. March SAT"
            className="block w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <button
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add date
        </button>
        {err && <div className="md:col-span-3 text-sm text-red-600">{err}</div>}
      </form>

      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No exam dates yet. Add the official SAT dates students can pick from.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-4 py-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">
                    {format(new Date(d.exam_date), "EEEE, MMMM d, yyyy")}
                  </div>
                  {d.label && <div className="text-xs text-slate-500">{d.label}</div>}
                </div>
                <button
                  onClick={() => toggle(d)}
                  className={
                    "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider " +
                    (d.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500")
                  }
                >
                  {d.active ? "Active" : "Hidden"}
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
