import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "./schema";

/** A student photo that falls back to initials when the URL is empty or fails to load. */
export function PersonAvatar({
  name,
  photo,
  className,
  fallbackClassName,
}: {
  name: string;
  photo: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      {photo && <AvatarImage src={photo} alt="" />}
      <AvatarFallback
        className={cn("bg-brand-400 text-[11px] font-bold text-white", fallbackClassName)}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
