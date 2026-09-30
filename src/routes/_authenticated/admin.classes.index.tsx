import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { RevealCard } from "@/components/ui/reveal-card";
import { ListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/panel";
import { createClass, listAllClasses, type ClassRow } from "@/lib/classes";
import { DAY_LABELS, listMemberships } from "@/lib/classes/classroom";
import { CLASS_CONTROL } from "@/components/classes/control";

export const Route = createFileRoute("/_authenticated/admin/classes/")({
  component: AdminClassesIndex,
});

function AdminClassesIndex() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listAllClasses();
      setClasses(rows);
      const next: Record<string, number> = {};
      for (const row of rows) {
        const members = await listMemberships(row.id).catch(() => []);
        next[row.id] = members.filter((member) => member.status === "active").length;
      }
      setCounts(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void createClass({ name })
            .then(() => {
              setName("");
              toast.success("Class created");
              return load();
            })
            .catch((err) =>
              toast.error(err instanceof Error ? err.message : "Could not create class"),
            );
        }}
      >
        <input
          className={CLASS_CONTROL + " max-w-sm"}
          placeholder="New class name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn-brand inline-flex items-center gap-1 rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          type="submit"
        >
          <Plus className="h-4 w-4" /> CREATE CLASS
        </button>
      </form>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No classes yet"
          body="Create a class to open its workspace."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((row) => (
            <Link
              key={row.id}
              to="/admin/classes/$classId"
              params={{ classId: row.id }}
              search={{
                tab: "attendance",
                month: new Date().toISOString().slice(0, 7),
                lesson: "",
              }}
            >
              <RevealCard className="lift rounded-2xl border border-brand-400/40 bg-brand-600 p-5 text-white">
                <h2 className="text-xl font-black text-white">{row.name}</h2>
                <p className="mt-1 text-sm font-bold uppercase text-white">
                  MATH{" "}
                  {(row.math_schedule_days ?? row.schedule_days ?? [])
                    .map((day) => DAY_LABELS[day - 1])
                    .filter(Boolean)
                    .join(" ") || "NOT SET"}
                  {" · "}
                  ENGLISH{" "}
                  {(row.ebrw_schedule_days ?? row.schedule_days ?? [])
                    .map((day) => DAY_LABELS[day - 1])
                    .filter(Boolean)
                    .join(" ") || "NOT SET"}
                  {" · "}
                  {counts[row.id] ?? 0} ACTIVE
                  {row.active ? "" : " · INACTIVE"}
                </p>
              </RevealCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
