import { UserAvatar, type UserAvatarSize } from "@/components/people/UserAvatar";
import { useAvatarUrl } from "@/lib/avatar/urls";

/** UserAvatar that resolves its own stored photo path (lookups on one page are batched). */
export function PersonAvatar({
  avatarUrl,
  name,
  size,
  className,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  size?: UserAvatarSize;
  className?: string;
}) {
  const src = useAvatarUrl(avatarUrl);
  return <UserAvatar src={src} name={name} size={size} className={className} />;
}
