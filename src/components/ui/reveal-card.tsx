import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { usePointerGlow, useAmbientGlow } from "@/hooks/usePointerGlow";
import { cn } from "@/lib/utils";

/**
 * A card that lights up under the cursor — border and background gradient both
 * track the pointer.
 *
 * Composes with the existing `lift` utility rather than replacing it: `lift`
 * handles the hover transform and shadow, this handles the lighting. Pass
 * `lift` in `className` alongside as usual.
 *
 * `reveal-surface` (styles.css) paints both gradient layers at z-index -1 inside
 * an isolated stacking context, so they land above the card's own background and
 * below every child without imposing any positioning on those children. It drops
 * onto existing card markup unchanged, including cards with absolutely
 * positioned decorative children.
 */
export function RevealCard({
  children,
  className,
  as: Tag = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "section" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  const ref = usePointerGlow<HTMLDivElement>();
  return (
    <Tag
      // The ref type is widened because `as` can name any block element; every
      // option is an HTMLElement, which is all the hook needs.
      ref={ref as never}
      className={cn("reveal-surface", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * `RevealCard` for navigation tiles.
 *
 * A card that is itself a link can't be a `RevealCard` wrapping a `<Link>` — that
 * nests a block inside an anchor, or leaves the glow on a box the anchor doesn't
 * fill. This forwards to TanStack's `<Link>` directly so `to`, `params` and
 * prefetching keep working while the surface lights up.
 *
 * Used by the admin overview tiles and the practice section cards, which are the
 * two screens made almost entirely of link-shaped cards.
 */
export function RevealLink({ className, children, ...rest }: LinkComponentProps<"a">) {
  const ref = usePointerGlow<HTMLAnchorElement>();
  return (
    <Link ref={ref} className={cn("reveal-surface", className)} {...rest}>
      {children}
    </Link>
  );
}

/**
 * The page-level ambient spotlight. Mount once, as a direct child of the
 * element that owns the page background and `isolate`.
 *
 * `position: fixed` + `z-index: -1` only reads as a glow on white if that
 * parent is a stacking context (`isolate`) *and* paints the white fill.
 * Without `isolate` the layer escapes and sits behind `bg-white` — invisible.
 * Do not mount this inside `route-enter` / `rise-in`: a transform ancestor
 * becomes the containing block and the overlay collapses to the content column.
 */
export function AmbientGlow() {
  const ref = useAmbientGlow<HTMLDivElement>();
  return <div ref={ref} aria-hidden="true" className="ambient-glow" />;
}
