import { createFileRoute, getRouteApi, Outlet } from "@tanstack/react-router";
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
  const { staffRole } = adminRoute.useRouteContext();
  const [allClasses, setAllClasses] = useState<ClassRow[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [classes, groupRows] = await Promise.all([listAllClasses(), listGroups(classId)]);
      setAllClasses(classes);
      setGroups(groupRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the class");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const klass = allClasses.find((row) => row.id === classId) ?? null;
  const value = useMemo<ClassContextValue | null>(
    () => (klass ? { klass, groups, allClasses, isAdmin: staffRole === "admin", reload } : null),
    [klass, groups, allClasses, staffRole, reload],
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
