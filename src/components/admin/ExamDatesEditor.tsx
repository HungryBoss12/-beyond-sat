import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-writes";
import { DateTimeField } from "@/components/ui/date-time-field";
import { ListSkeleton } from "@/components/ui/skeletons";

type ExamDate = {
  id: string;
  exam_date: string;
  label: string | null;
  active: boolean;
};

/* `exam_date` is a DATE, so it arrives as a bare "YYYY-MM-DD" and `new Date()`
   would read it as UTC midnight, one day early west of Greenwich. */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function ExamDatesEditor() {
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
    void load();
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
    void load();
  }

  async function toggle(row: ExamDate) {
    await adminWrite("Could not change the exam date", () =>
      supabase.from("exam_dates").update({ active: !row.active }).eq("id", row.id),
    );
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this exam date?")) return;
    await adminWrite("Could not remove the exam date", () =>
      supabase.from("exam_dates").delete().eq("id", id),
    );
    void load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-100">
            Exam date
          </span>
          <DateTimeField dateOnly value={date} onChange={setDate} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-100">
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
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add date
        </button>
        {err && (
          <div className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60 md:col-span-3">
            {err}
          </div>
        )}
      </form>

      {items === null ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <p className="text-sm text-brand-100">No exam dates yet.</p>
      ) : (
        <ul className="divide-y divide-brand-400/30 overflow-hidden rounded-xl bg-brand-800/70">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-4 px-3 py-3">
              <CalendarDays className="h-5 w-5 shrink-0 text-brand-200" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">
                  {format(parseLocalDate(d.exam_date), "EEEE, MMMM d, yyyy")}
                </div>
                {d.label && <div className="text-xs text-brand-100">{d.label}</div>}
              </div>
              <button
                type="button"
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
                type="button"
                onClick={() => remove(d.id)}
                className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                aria-label="Remove exam date"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
