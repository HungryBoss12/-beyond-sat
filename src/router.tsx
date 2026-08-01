import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "./components/ui/skeletons";
import { RouteError, RouteNotFound } from "./components/ui/route-error";

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

    /* Error boundaries. An exception thrown while rendering a route otherwise
     * tears down the tree and leaves a blank page, which is impossible to tell
     * apart from a CSS problem and reports as "the screen is just white". These
     * make the failure visible and give the user a way out of it. */
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  });

  return router;
};
