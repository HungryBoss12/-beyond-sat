import { supabase } from "@/integrations/supabase/client";
import { LESSON_UPLOADS_BUCKET } from "@/lib/storage-url";

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

export async function uploadLessonVideo(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const path = `${u.user.id}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(LESSON_UPLOADS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}
