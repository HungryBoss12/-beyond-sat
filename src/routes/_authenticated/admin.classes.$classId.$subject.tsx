import {
  createFileRoute,
  redirect,
  useNavigate,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/ui/panel";
import { groupFor, useClassContext } from "@/components/classes/ClassContext";
import {
  ClassroomWorkspace,
  WORKSPACE_TABS,
  type WorkspaceSearch,
} from "@/components/classes/ClassroomWorkspace";
import { monthKey } from "@/lib/classes/classroom";
import { slugToSubject } from "@/lib/classes/schemes";

const searchSchema = z.object({
  tab: z.enum(WORKSPACE_TABS).catch("attendance"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .catch(() => monthKey()),
  lesson: z.string().catch(""),
  q: z.string().catch(""),
  status: z.enum(["", "active", "trial", "frozen", "debt"]).catch(""),
  sections: z.coerce
    .number()
    .transform((n) => (n === 1 ? 1 : 0) as 0 | 1)
    .catch(0),
});

export const Route = createFileRoute("/_authenticated/admin/classes/$classId/$subject")({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    searchSchema.parse(search),
  beforeLoad: ({ params }) => {
    if (!slugToSubject(params.subject)) {
      throw redirect({
        to: "/admin/classes/$classId",
        params: { classId: params.classId },
        search: { tab: "roster" },
      });
    }
  },
  component: SubclassPage,
});

function SubclassPage() {
  const { subject: slug, classId } = Route.useParams();
  const search = Route.useSearch() as WorkspaceSearch;
  const navigate = useNavigate();
  const { klass, groups, allClasses, isAdmin, reload } = useClassContext();
  const subject = slugToSubject(slug) ?? "math";
  const group = groupFor(groups, subject);
  const sibling = groupFor(groups, subject === "math" ? "ebrw" : "math");

  const onNavigate = useCallback(
    (patch: Partial<WorkspaceSearch>) =>
      void navigate({
        to: "/admin/classes/$classId/$subject",
        params: { classId, subject: slug },
        search: { ...search, ...patch },
        replace: patch.q !== undefined,
      }),
    [navigate, classId, slug, search],
  );

  if (!group) {
    return (
      <EmptyState title="Sub-class not found" body="This parent class is missing a sub-class." />
    );
  }
  return (
    <ClassroomWorkspace
      key={group.id}
      klass={klass}
      group={group}
      sibling={sibling}
      allClasses={allClasses}
      isAdmin={isAdmin}
      search={search}
      onNavigate={onNavigate}
      onReload={reload}
    />
  );
}
