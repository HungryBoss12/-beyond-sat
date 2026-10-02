import { createFileRoute, getRouteApi, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/panel";
import { ClassContext, type ClassContextValue } from "@/components/classes/ClassContext";
import { listAllClasses, type ClassRow } from "@/lib/classes";
import { listGroups, type ClassGroup } from "@/lib/classes/groups";

export const Route = createFileRoute("/_authenticated/admin/classes/$classId")({
  component: ClassLayout,
});

const adminRoute = getRouteApi("/_authenticated/admin");

/** Loads the parent class and its two sub-classes once for the overview, workspace and profile. */
function ClassLayout() {
  const { classId } = Route.useParams();
  const { staffRole, userId } = adminRoute.useRouteContext();
  const navigate = useNavigate();
  const [allClasses, setAllClasses] = useState<ClassRow[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isTeacher = staffRole === "teacher";

  const reload = useCallback(async () => {
    try {
      const [classes, groupRows, taught] = await Promise.all([
        listAllClasses(),
        listGroups(classId),
        isTeacher ? listGroups() : Promise.resolve(null),
      ]);
      const mine = isTeacher
        ? groupRows.filter((group) => group.teacher_id === userId)
        : groupRows;
      const taughtIds = new Set(
        (taught ?? []).filter((group) => group.teacher_id === userId).map((group) => group.class_id),
      );
      setAllClasses(isTeacher ? classes.filter((row) => taughtIds.has(row.id)) : classes);
      setGroups(mine);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the class");
    } finally {
      setLoading(false);
    }
  }, [classId, isTeacher, userId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!isTeacher || loading || error) return;
    if (!groups.some((group) => group.teacher_id === userId)) {
      void navigate({ to: "/admin/classes", replace: true });
    }
  }, [isTeacher, loading, error, groups, userId, navigate]);

  const klass = allClasses.find((row) => row.id === classId) ?? null;
  const value = useMemo<ClassContextValue | null>(
    () =>
      klass
        ? { klass, groups, allClasses, isAdmin: staffRole === "admin", isTeacher, reload }
        : null,
    [klass, groups, allClasses, staffRole, isTeacher, reload],
  );

  if (loading) return <ListSkeleton rows={5} />;
  if (error || !value) {
    return (
      <EmptyState
        title={error ? "Could not load the class" : "Class not found"}
        body={error ?? "It may have been deleted."}
      />
    );
  }
  return (
    <ClassContext.Provider value={value}>
      <Outlet />
    </ClassContext.Provider>
  );
}
