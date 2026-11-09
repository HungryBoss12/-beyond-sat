import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/examdates")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/settings", hash: "exam-dates" });
  },
});
