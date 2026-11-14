import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { UserAvatar, type UserAvatarSize } from "@/components/people/UserAvatar";
import { useAvatarUrls } from "@/lib/avatar/urls";
import { removeMyAvatar, uploadMyAvatar } from "@/lib/avatar/upload";

/**
 * Change or remove my own profile picture. The photo is cropped, uploaded and saved on
 * my profile as soon as it is chosen, so there is nothing to confirm afterwards.
 */
export function AvatarPicker({
  value,
  name,
  onChange,
  size = "xl",
}: {
  value: string | null;
  name: string;
  onChange: (path: string | null) => void;
  size?: UserAvatarSize;
}) {
  const urls = useAvatarUrls([value]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadMyAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the photo.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      await removeMyAvatar();
      onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        className="relative rounded-full ring-2 ring-brand-400/50 transition hover:ring-brand-200"
      >
        <UserAvatar src={value ? urls.get(value) : null} name={name} size={size} />
        <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand-400 text-white shadow-brand ring-2 ring-brand-800">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void pick(file);
        }}
      />
      <div className="min-w-0 space-y-1 text-xs text-white">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="tap font-bold underline-offset-2 hover:underline disabled:opacity-50"
          >
            {value ? "Change photo" : "Add photo"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => void clear()}
              disabled={busy}
              className="tap inline-flex items-center gap-1 font-bold text-brand-100 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
            </button>
          ) : null}
        </div>
        <p className="text-brand-100">Every signed-in user can see your photo.</p>
        {error ? <p className="font-semibold text-white">{error}</p> : null}
      </div>
    </div>
  );
}
