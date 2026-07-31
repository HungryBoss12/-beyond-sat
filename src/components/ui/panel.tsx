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
 * The base surface. Panels are brand-blue surfaces sitting on the white page
 * background — white is reserved for the page itself. `tone` picks which layer
 * of the blue ramp the panel occupies:
 *  - `plain`  #11269D base, for the majority of panels
 *  - `soft`   a subtle gradient over the base, for panels that should recede
 *  - `brand`  the full base→deep gradient, for a single focal panel per screen
 *
 * All three are dark, so text inside is white by default and secondary text
 * uses `text-brand-100` (#B8C0E8) rather than a reduced opacity.
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
        "relative rounded-2xl border p-5 md:p-6 text-white",
        tone === "plain" && "border-brand-400/40 bg-brand-600 shadow-panel",
        tone === "soft" && "border-brand-400/30 bg-grad-surface shadow-panel",
        tone === "brand" && "border-brand-400/50 bg-grad-brand shadow-brand",
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
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-100">
          {label}
        </div>
        {hint && <div className="mt-0.5 truncate text-xs text-brand-100">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {Icon && (
          /* Icon tiles use the lighter shade so they separate from the panel
             they sit on; all three tones are white-on-light-blue now. */
          <span
            className={cx(
              "grid h-8 w-8 place-items-center rounded-xl text-white",
              tone === "brand" && "bg-brand-400",
              tone === "muted" && "bg-brand-800",
              tone === "warm" && "bg-brand-400",
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
      <div className="drift absolute -right-16 -top-24 h-56 w-56 rounded-full bg-brand-400/30 blur-3xl" />
      <div
        className="drift absolute -bottom-28 -left-12 h-52 w-52 rounded-full bg-brand-300/20 blur-3xl"
        style={{ animationDelay: "-6s" }}
      />
    </div>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cx("skeleton rounded-lg", className)} style={style} />;
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
        "grid place-content-center justify-items-center rounded-xl border border-dashed border-brand-300/50 bg-brand-800/50 px-4 py-8 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-400 text-white shadow-panel">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="text-sm font-semibold text-white">{title}</div>
      {body && <p className="mt-1 max-w-xs text-xs leading-relaxed text-brand-100">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
