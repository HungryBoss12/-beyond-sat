import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-2xl md:h-20 md:w-20",
  xl: "h-24 w-24 text-3xl",
} as const;

export type UserAvatarSize = keyof typeof SIZES;

export function avatarInitials(name: string | null | undefined): string {
  const parts = (name ?? "").replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** A person's photo, or their initials on a brand circle when there is no photo or it fails to load. */
export function UserAvatar({
  src,
  name,
  size = "sm",
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: UserAvatarSize;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const showImage = Boolean(src) && !broken;
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-400 font-black text-white",
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={name ? `${name}'s photo` : ""}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{avatarInitials(name)}</span>
      )}
    </span>
  );
}
