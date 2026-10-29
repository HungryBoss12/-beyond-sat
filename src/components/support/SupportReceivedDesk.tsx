import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { SupportHandoff } from "@/components/support/SupportHandoff";
import { loadMySupportSubject, loadReceivedStudents, subjectLabel, tashkentCalendarToday } from "@/lib/support/api";
import type { ClassSubject } from "@/lib/classes/types";

type Received = {
  id: string;
  name: string;
  subject: ClassSubject;
  class_name: string;
  sent_by: string;
};

function monthDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setDate(1 - startPad);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + index);
    return day;
  });
}

export function SupportReceivedDesk() {
  const [rows, setRows] = useState<Received[]>([]);
  const [subject, setSubject] = useState<ClassSubject | null | undefined>(undefined);
  const [month, setMonth] = useState(() => tashkentCalendarToday());
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    void loadReceivedStudents()
      .then(setRows)
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load students"));
    void loadMySupportSubject()
      .then(setSubject)
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load your subject"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-brand-900">Support</h1>
      <Panel className="space-y-3 p-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-black">
          <Users className="h-4 w-4" aria-hidden="true" /> {rows.length} received
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/30 text-xs">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2">Subject</th>
                <th className="px-2 py-2">Sent by</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-3">
                    No students have been sent to you yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/15">
                    <td className="px-2 py-2 font-bold">{row.name}</td>
                    <td className="px-2 py-2">{row.class_name || "—"}</td>
                    <td className="px-2 py-2">{subjectLabel(row.subject)}</td>
                    <td className="px-2 py-2">{row.sent_by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </button>
          <h2 className="text-sm font-black">
            {month.toLocaleString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
            <div key={name}>{name}</div>
          ))}
          {monthDays(month).map((date) => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const inMonth = date.getMonth() === month.getMonth();
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDay(key)}
                className={`rounded-lg py-2 ${day === key ? "bg-white text-brand-900" : "bg-brand-800"} ${inMonth ? "" : "opacity-40"}`}
              >
                {day === key && <Check className="mx-auto mb-0.5 h-3 w-3" aria-hidden="true" />}
                {date.getDate()}
              </button>
            );
          })}
        </div>
        {day && subject ? (
          <div key={day} className="widen-in">
            <p className="text-xs font-bold">{subjectLabel(subject)} sessions. Choose a student for an open time.</p>
            <SupportHandoff day={day} selfSubject={subject} />
          </div>
        ) : null}
        {day && subject === null ? (
          <p className="text-sm">An admin has not set your subject yet.</p>
        ) : null}
      </Panel>
    </div>
  );
}
