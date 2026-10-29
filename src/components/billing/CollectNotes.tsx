import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { ClassSubject } from "@/lib/classes/types";
import { collectNoteKey, type CollectNote } from "@/lib/billing/collect-notes";
import { debtSheets, type DebtSideRow } from "@/lib/billing/debt-sheet";
import type { BalanceRow } from "@/lib/billing/types";

export function CollectNotes({
  rows,
  notes,
  onSave,
}: {
  rows: BalanceRow[];
  notes: CollectNote[];
  onSave: (note: CollectNote) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const map = useMemo(
    () => new Map(notes.map((note) => [collectNoteKey(note.user_id, note.class_id, note.subject), note])),
    [notes],
  );
  const sheets = useMemo(() => debtSheets(rows, map), [rows, map]);

  if (sheets.length === 0) return null;

  return (
    <section className="rounded-2xl border border-brand-400/40 bg-white p-4 text-brand-900">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm font-black"
        onClick={() => setOpen((value) => !value)}
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        Expect date and reason
      </button>
      {open && (
        <div className="widen-in mt-4 space-y-6">
          {sheets.map((sheet) => (
            <div key={sheet.title}>
              <h3 className="text-sm font-black">{sheet.title}</h3>
              <div className="mt-2 grid gap-4 lg:grid-cols-2">
                <NoteTable title="English" rows={sheet.english} onSave={onSave} />
                <NoteTable title="Math" rows={sheet.math} onSave={onSave} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NoteTable({
  title,
  rows,
  onSave,
}: {
  title: string;
  rows: DebtSideRow[];
  onSave: (note: CollectNote) => Promise<void>;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-brand-700">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-brand-700">No students.</p>
      ) : (
        <ul className="mt-1 divide-y divide-brand-100">
          {rows.map((row) => (
            <NoteLine key={`${row.userId}:${row.classId}:${row.subject}`} row={row} onSave={onSave} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteLine({ row, onSave }: { row: DebtSideRow; onSave: (note: CollectNote) => Promise<void> }) {
  const [expectOn, setExpectOn] = useState(row.expectOn);
  const [reason, setReason] = useState(row.reason);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExpectOn(row.expectOn);
    setReason(row.reason);
  }, [row.expectOn, row.reason]);

  async function save(next: { expectOn: string; reason: string }) {
    setError(null);
    try {
      await onSave({
        user_id: row.userId,
        class_id: row.classId,
        subject: row.subject as ClassSubject,
        expect_on: next.expectOn || null,
        reason: next.reason,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <li className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] sm:items-center">
      <span className="truncate text-sm font-bold">{row.name}</span>
      <input
        type="date"
        aria-label={`Expect date for ${row.name}`}
        value={expectOn}
        onChange={(event) => {
          const value = event.target.value;
          setExpectOn(value);
          void save({ expectOn: value, reason });
        }}
        className="rounded-lg border border-brand-400/40 px-2 py-1 text-xs"
      />
      <input
        aria-label={`Reason for ${row.name}`}
        value={reason}
        placeholder="Reason"
        onChange={(event) => setReason(event.target.value)}
        onBlur={() => void save({ expectOn, reason })}
        className="rounded-lg border border-brand-400/40 px-2 py-1 text-xs"
      />
      {error && <span className="text-xs font-bold text-red-700 sm:col-span-3">{error}</span>}
    </li>
  );
}
