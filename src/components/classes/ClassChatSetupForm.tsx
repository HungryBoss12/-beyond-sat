import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Users } from "lucide-react";
import {
  isValidUsername,
  listActiveClasses,
  normalizeUsername,
  saveChatSetup,
  uploadAvatar,
  type ClassRow,
} from "@/lib/classes";

const CONTROL =
  "w-full rounded-xl border-2 border-brand-400/50 bg-brand-800 px-4 py-3 text-sm font-semibold text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

/**
 * Shared class + chat profile setup used by onboarding (new users) and profile
 * (existing users who registered before Classes shipped).
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
  const [classId, setClassId] = useState("");
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
        const rows = await listActiveClasses();
        setClasses(rows);
        if (rows.length === 1) setClassId(rows[0].id);
      } catch (e) {
        setErr((e as Error)?.message ?? "Could not load classes.");
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
    if (!classId) {
      setErr("Pick your class group.");
      return;
    }
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
        class_id: classId,
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading classes…
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {!compact && (
        <div>
          <h2 className="text-xl font-black text-white">Join your class</h2>
          <p className="mt-1 text-sm text-brand-100">
            Choose your group, pick a username for Classes chat, and optionally connect Telegram.
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

      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-100">
          <Users className="h-3.5 w-3.5" /> Class group
        </span>
        {classes.length === 0 ? (
          <p className="rounded-xl border border-brand-400/40 bg-brand-800 px-4 py-3 text-sm text-brand-100">
            No classes yet. Ask an admin to create one, then refresh.
          </p>
        ) : (
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={CONTROL}>
            <option value="">Select your class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </label>

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
        disabled={saving || uploading || classes.length === 0}
        className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-400 py-3 font-bold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}
