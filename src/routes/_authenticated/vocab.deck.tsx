import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vocab/deck")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "");
    if (path === "/vocab/deck") {
      throw redirect({ to: "/vocab/decks", replace: true });
    }
  },
  component: () => <Outlet />,
});
