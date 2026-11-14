import { supabase } from "@/integrations/supabase/client";
import { AVATARS_BUCKET, LEGACY_AVATAR_BUCKET, isAvatarPath, newAvatarPath } from "./paths";
import { prepareAvatar } from "./prepare";
import { invalidateAvatar } from "./urls";

// The generated types do not list this RPC yet.
type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
};

function token(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Best effort: a missing file is fine, and the row is already updated. */
async function removeObject(path: string | null | undefined): Promise<void> {
  const value = (path ?? "").trim();
  if (!value) return;
  await Promise.allSettled([
    supabase.storage.from(AVATARS_BUCKET).remove([value]),
    supabase.storage.from(LEGACY_AVATAR_BUCKET).remove([value]),
  ]);
  invalidateAvatar(value);
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

/** Crop, upload, save the path on the profile, then delete the previous file. Returns the new path. */
export async function uploadMyAvatar(file: File): Promise<string> {
  const uid = await currentUserId();
  const { blob, ext } = await prepareAvatar(file);
  const path = newAvatarPath(uid, ext, token());
  if (!isAvatarPath(path, uid)) throw new Error("Could not prepare the photo.");

  const { error: upErr } = await supabase.storage.from(AVATARS_BUCKET).upload(path, blob, {
    upsert: false,
    contentType: blob.type,
    cacheControl: "31536000",
  });
  if (upErr) throw new Error(upErr.message);

  const { data: before } = await supabase.from("profiles").select("avatar_url").eq("id", uid).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", uid);
  if (error) {
    await removeObject(path);
    throw new Error(error.message);
  }
  const previous = before?.avatar_url;
  if (previous && previous !== path) await removeObject(previous);
  return path;
}

/** Clear my photo and delete the file. */
export async function removeMyAvatar(): Promise<void> {
  const uid = await currentUserId();
  const { data: before } = await supabase.from("profiles").select("avatar_url").eq("id", uid).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid);
  if (error) throw new Error(error.message);
  await removeObject(before?.avatar_url);
}

/** Staff moderation: clear anyone's photo, then delete the file. */
export async function staffRemoveAvatar(userId: string, ref: string | null | undefined): Promise<void> {
  await removeObject(ref);
  const { error } = await (supabase as unknown as RpcClient).rpc("staff_remove_avatar", { p_user_id: userId });
  if (error) throw new Error(error.message);
}
