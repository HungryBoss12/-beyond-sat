import { useCallback, useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { IconButton } from "@/components/ui/icon-button";
import { VoidDialog } from "@/components/billing/VoidDialog";
import {
  listLevelHistory,
  voidLevelScore,
  type ClassGroup,
  type LevelScoreEntry,
  type LevelSection,
} from "@/lib/classes/groups";
import { cn } from "@/lib/utils";

/** Every dated entry per section. Corrections are void (with a reason) and re-enter. */
export function LevelHistorySheet({
  open,
  group,
  sections,
  student,
  onClose,
  onChanged,
}: {
  open: boolean;
  group: ClassGroup;
  sections: LevelSection[];
  student: { userId: string; name: string } | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [rows, setRows] = useState<LevelScoreEntry[]>([]);
  const [voiding, setVoiding] = useState<LevelScoreEntry | null>(null);

  const load = useCallback(async () => {
    if (!student) return;
    try {
      setRows(await listLevelHistory(group.id, student.userId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the history");
    }
  }, [group.id, student]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const sectionName = new Map(sections.map((s) => [s.id, s.name]));

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-white">Level history</SheetTitle>
          <SheetDescription className="text-white">
            {student?.name} · {group.name}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {sections.map((section) => {
            const entries = rows.filter((r) => r.section_id === section.id);
            if (!entries.length) return null;
            return (
              <section key={section.id}>
                <h3 className="text-xs font-bold text-white">{section.name}</h3>
                <ul className="mt-1 divide-y divide-brand-400/30">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span
                        className={cn(
                          "tabular-nums",
                          entry.voided_at && "text-brand-200 line-through",
                        )}
                      >
                        <span className="font-black">{entry.score}</span> · {entry.assessed_on}
                        {entry.voided_at && (
                          <span className="ml-1 text-xs no-underline">({entry.void_reason})</span>
                        )}
                      </span>
                      {!entry.voided_at && (
                        <IconButton
                          icon={Ban}
                          label={`Void ${sectionName.get(entry.section_id)} ${entry.score} from ${entry.assessed_on}`}
                          className="h-8 min-w-8 w-8 text-white hover:bg-brand-500"
                          onClick={() => setVoiding(entry)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {rows.length === 0 && <p className="text-sm text-white">No assessments yet.</p>}
        </div>
        <VoidDialog
          open={voiding != null}
          title="Void level score"
          description={
            voiding
              ? `${sectionName.get(voiding.section_id)} · ${voiding.score} · ${voiding.assessed_on}`
              : ""
          }
          onClose={() => setVoiding(null)}
          onVoid={async (reason) => {
            if (!voiding) return;
            await voidLevelScore(voiding.id, reason);
            toast.success("Score voided");
            await load();
            await onChanged();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
