import type { LucideIcon } from "lucide-react";

/**
 * Shared surface primitives for the app's data screens.
 *
 * The dashboard, analysis and admin pages were each declaring their own local
 * `Card` / `CardHead`, which is how three surfaces drift apart. These are the
 * single definition: same radius, same border, same elevation everywhere.
 */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * The base surface. `tone` picks the fill:
 *  - `plain`  white, for the majority of panels
 *  - `soft`   a barely-tinted white gradient, for panels that should recede
 *  - `brand`  the saturated brand gradient, for a single focal CTA per screen
 */
export function Panel({
  children,
  className,
  tone = "plain",
  interactive = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "soft" | "brand";
  interactive?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={cx(
        "relative rounded-2xl border p-5 md:p-6",
        tone === "plain" && "border-slate-200/80 bg-white shadow-panel",
        tone === "soft" && "border-slate-200/70 bg-grad-surface shadow-panel",
        tone === "brand" && "border-transparent bg-grad-brand text-white shadow-brand",
        interactive && "lift",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Panel header: small uppercase label on the left, optional icon tile on the
 * right, with room for a trailing control (a filter, a "view all" link).
 */
export function PanelHead({
  label,
  icon: Icon,
  hint,
  action,
  tone = "brand",
}: {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  action?: React.ReactNode;
  tone?: "brand" | "muted" | "warm";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </div>
        {hint && <div className="mt-0.5 truncate text-xs text-slate-400">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {Icon && (
          <span
            className={cx(
              "grid h-8 w-8 place-items-center rounded-xl",
              tone === "brand" && "bg-blue-50 text-blue-600",
              tone === "muted" && "bg-slate-100 text-slate-500",
              tone === "warm" && "bg-orange-50 text-orange-500",
            )}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.1} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Page-level heading block, used at the top of each route. */
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rise-in md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 self-start md:self-auto">{action}</div>}
    </div>
  );
}

/**
 * Ambient blurred blobs for hero panels. Purely decorative, so it's hidden from
 * assistive tech and sits behind content via a negative z-index.
 */
export function PanelGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("pointer-events-none absolute inset-0 overflow-hidden rounded-2xl", className)}
    >
      <div className="drift absolute -right-16 -top-24 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />
      <div
        className="drift absolute -bottom-28 -left-12 h-52 w-52 rounded-full bg-blue-100/50 blur-3xl"
        style={{ animationDelay: "-6s" }}
      />
    </div>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-lg", className)} />;
}

/** Dashed empty-state box with an optional icon and call to action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid place-content-center justify-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-400 shadow-panel">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {body && <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
