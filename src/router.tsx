import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "./components/ui/skeletons";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,

    /* Route transitions.
     *
     * The default `defaultPendingMs` is 1000ms, which is what made switching
     * sections feel broken: for a full second after the click the *previous*
     * section stayed on screen, and only then did a fallback appear. Dropping
     * it to 80ms hands the screen over almost immediately, so old content
     * clears on click. `defaultPendingMinMs` then holds the placeholder long
     * enough to be read as a deliberate transition rather than a flicker.
     *
     * The fallback is a route-shaped skeleton instead of a spinner, so the
     * layout is already in place when the real content arrives. */
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 80,
    defaultPendingMinMs: 260,
  });

  return router;
};
