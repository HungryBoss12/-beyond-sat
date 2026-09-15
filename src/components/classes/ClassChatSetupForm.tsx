import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import {
  getChatProfile,
  isValidUsername,
  listActiveClasses,
  normalizeUsername,
  resolveAvatarUrl,
  saveChatSetup,
  uploadAvatar,
  type ClassRow,
} from "@/lib/classes";

const CONTROL =
  "w-full rounded-xl border-2 border-brand-400/50 bg-brand-800 px-4 py-3 text-sm font-semibold text-white outline-none transition duration-200 [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:ring-2 focus:ring-brand-300/40";

/**
 * Chat profile setup used by onboarding (new users) and profile.
 * Class group is assigned by an admin — students only set username / photo / Telegram.
 */
export function ClassChatSetupForm({
  onDone,
  submitLabel = "Save and continue",
  compact = false,
}: {
  onDone?: () => void;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    void (async () => {
      try {
        const [rows, profile] = await Promise.all([listActiveClasses(), getChatProfile()]);
        setClasses(rows);

        if (profile?.username) setUsername(profile.username);
        if (profile?.telegram_username) setTelegram(profile.telegram_username);
        if (profile?.avatar_url) {
          setAvatarPath(profile.avatar_url);
          const url = await resolveAvatarUrl(profile.avatar_url);
          if (url) setAvatarPreview(url);
        }
        if (profile?.class_id) setClassId(profile.class_id);
      } catch (e) {
        setErr((e as Error)?.message ?? "Could not load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onAvatar(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const local = URL.createObjectURL(file);
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return local;
      });
      setAvatarPath(await uploadAvatar(file));
    } catch (e) {
      setErr((e as Error)?.message ?? "Avatar upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setErr(null);
    if (!isValidUsername(username)) {
      setErr("Username must be 3–24 characters, start with a letter, and use only a-z, 0-9, _.");
      return;
    }
    setSaving(true);
    try {
      await saveChatSetup({
        username: normalizeUsername(username),
        avatar_url: avatarPath,
        telegram_username: telegram || null,
      });
      onDone?.();
    } catch (e) {
      const msg = (e as Error)?.message ?? "Could not save.";
      setErr(msg.includes("profiles_username") ? "That username is taken." : msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-brand-100">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const assignedName = classId
    ? (classes.find((c) => c.id === classId)?.name ?? "Your assigned group")
    : null;

  return (
    <div className={(compact ? "space-y-4" : "space-y-5") + " rise-in"}>
      {!compact && (
        <div>
          <h2 className="text-xl font-black text-white">Set up Classes chat</h2>
          <p className="mt-1 text-sm text-brand-100">
            Pick a username for Classes chat and optionally connect Telegram. Your teacher assigns
            your class group.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-brand-800 ring-2 ring-brand-400/50"
          aria-label="Upload profile photo"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-5 w-5 text-brand-100" />
          )}
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-brand-900/60">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onAvatar(f);
          }}
        />
        <div className="text-xs text-brand-100">
          Profile photo (optional). You can also just use a username.
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-100">
          Username
        </span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. javaz_sat"
          className={CONTROL}
          autoComplete="off"
        />
      </label>

      <div className="rounded-xl border border-brand-400/40 bg-brand-800 px-4 py-3 text-sm">
        {assignedName ? (
          <>
            <p className="font-semibold text-white">{assignedName}</p>
            <p className="mt-0.5 text-xs text-brand-100">
              Assigned by your teacher — contact them to switch groups.
            </p>
          </>
        ) : (
          <p className="text-brand-100">
            Your teacher will assign you to a class. You can finish chat setup now and join chats
            once you are added.
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-100">
          Telegram (optional)
        </span>
        <input
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          placeholder="@username — connect later when TG API is ready"
          className={CONTROL}
          autoComplete="off"
        />
      </label>

      {err && (
        <div className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
          {err}
        </div>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || uploading}
        className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-400 py-3 font-bold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}
