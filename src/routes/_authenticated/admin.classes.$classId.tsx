import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { getRouteApi } from "@tanstack/react-router";
import { ClassroomWorkspace } from "@/components/classes/ClassroomWorkspace";
import { listAllClasses, type ClassRow } from "@/lib/classes";
import { monthKey } from "@/lib/classes/classroom";

const searchSchema = z.object({
  tab: z.enum(["attendance", "var", "ranking", "homework", "chat"]).catch("attendance"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .catch(monthKey()),
  lesson: z.string().catch(""),
});

export const Route = createFileRoute("/_authenticated/admin/classes/$classId")({
  validateSearch: (search) => searchSchema.parse(search),
  component: AdminClassPage,
});

const adminRoute = getRouteApi("/_authenticated/admin");

function AdminClassPage() {
  const { classId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { staffRole } = adminRoute.useRouteContext();
  const [row, setRow] = useState<ClassRow | null>(null);

  const load = useCallback(async () => {
    const rows = await listAllClasses();
    setRow(rows.find((item) => item.id === classId) ?? null);
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!row) return <p className="text-sm text-brand-100">Class not found.</p>;

  return (
    <ClassroomWorkspace
      classRow={row}
      tab={search.tab}
      month={search.month}
      lesson={search.lesson}
      isAdmin={staffRole === "admin"}
      onChanged={load}
      onNavigate={(patch) => {
        void navigate({
          to: "/admin/classes/$classId",
          params: { classId },
          search: { ...search, ...patch },
        });
      }}
    />
  );
}
