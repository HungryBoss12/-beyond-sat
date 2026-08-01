import { Link } from "@tanstack/react-router";
import { Compass, RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Router-level error and not-found boundaries.
 *
 * Without an error component, any exception thrown while rendering a route
 * unmounts the tree and leaves a blank white page. That failure mode is
 * indistinguishable from a styling bug, and the only trace is a console message
 * nobody sees — every "the page is just white" report starts here. These turn
 * it into something readable and reportable.
 */
export function RouteError({ error }: { error: Error }) {
  return (
    <div className="grid min-h-[70vh] w-full place-items-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center shadow-panel">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-800 text-white ring-1 ring-brand-300/60">
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-black tracking-tight text-white">
          This page hit an error
        </h1>
        <p className="mt-2 text-sm text-brand-100">
          Something went wrong while rendering. Reloading usually clears it.
        </p>
        <p className="mt-4 break-words rounded-lg bg-brand-900 px-3 py-2 text-left text-xs font-semibold text-white ring-1 ring-brand-300/60">
          {error?.message || "Unknown error"}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2.5 text-sm font-bold text-white"
          >
            <RotateCcw className="h-4 w-4" /> Reload
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-brand-400/40 hover:bg-brand-900 hover:ring-brand-300/60"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="grid min-h-[70vh] w-full place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center shadow-panel">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-800 text-white">
          <Compass className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-black tracking-tight text-white">Page not found</h1>
        <p className="mt-2 text-sm text-brand-100">
          That link doesn&apos;t point anywhere in the app.
        </p>
        <Link
          to="/dashboard"
          className="btn-brand mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2.5 text-sm font-bold text-white"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
