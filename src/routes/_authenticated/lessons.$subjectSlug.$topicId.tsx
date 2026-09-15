import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/lessons/$subjectSlug/$topicId")({
  component: () => <Outlet />,
});
