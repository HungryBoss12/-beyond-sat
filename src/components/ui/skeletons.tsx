import { useRouterState } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/panel";

/**
 * Route-shaped loading placeholders.
 *
 * Sections used to fall back to a spinning `Loader2`, which tells you something
 * is happening but not what, and leaves the layout to jump once data lands.
 * These mirror the real shape of each screen instead, so a page fills in rather
 * than reflowing — the treatment the dashboard already used, now everywhere.
 *
 * Blocks sit directly on the white page background. The `skeleton` utility
 * shimmers through the brand ramp, so a block must never be placed on a
 * `bg-brand-600` surface — it would vanish into it.
 */

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

/** Title + subtitle bars, matching <PageHead>. */
export function HeadSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2.5">
      <Skeleton className={"h-8 md:h-9 " + (wide ? "w-72" : "w-52")} />
      <Skeleton className="h-4 w-44" />
    </div>
  );
}

/** Row of compact stat tiles. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {range(count).map((i) => (
        <Skeleton key={i} className="h-[74px] rounded-2xl" />
      ))}
    </div>
  );
}

/** Two-column panel grid — the analysis / practice / profile shape. */
export function PanelGridSkeleton({
  count = 2,
  height = 260,
}: {
  count?: number;
  height?: number;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {range(count).map((i) => (
        <Skeleton key={i} className="rounded-2xl" style={{ height }} />
      ))}
    </div>
  );
}

/** Stack of list rows — news, history, admin tables. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {range(rows).map((i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

/** Generic section fallback: heading, stat row, then panels. */
export function SectionSkeleton() {
  return (
    <div className="space-y-6">
      <HeadSkeleton />
      <StatRowSkeleton />
      <PanelGridSkeleton />
    </div>
  );
}

/** Card grid — practice landing, mock list, news index. */
export function CardGridSkeleton({ count = 4, height = 200 }: { count?: number; height?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {range(count).map((i) => (
        <Skeleton key={i} className="rounded-2xl" style={{ height }} />
      ))}
    </div>
  );
}

/** Long-form article / detail page. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <HeadSkeleton wide />
      <Skeleton className="h-56 rounded-2xl" />
      <div className="space-y-3">
        {range(6).map((i) => (
          <Skeleton key={i} className={"h-4 " + (i % 3 === 2 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

/** Admin table: toolbar above, rows below. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <Skeleton className="h-11 rounded-t-xl" />
      <div className="space-y-2">
        {range(rows).map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Router-level fallback, shown while a route's code chunk or loader is in
 * flight. Picks a shape from the pathname so the placeholder resembles the
 * screen being navigated to rather than showing one generic block everywhere.
 */
export function RoutePending() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  let body = <SectionSkeleton />;
  if (pathname.startsWith("/news/")) body = <DetailSkeleton />;
  else if (pathname.startsWith("/news")) body = <ListSkeleton rows={5} />;
  else if (pathname.startsWith("/admin")) body = <TableSkeleton />;
  else if (pathname.startsWith("/practice/mock")) body = <CardGridSkeleton count={4} />;
  else if (pathname === "/practice" || pathname === "/practice/")
    body = (
      <div className="space-y-6">
        <HeadSkeleton />
        <CardGridSkeleton count={2} height={220} />
        <CardGridSkeleton count={2} height={170} />
      </div>
    );

  return (
    <div key={pathname} className="route-enter">
      {body}
    </div>
  );
}
