import { supabase } from "@/integrations/supabase/client";
import type { ClassSubject } from "@/lib/classes/types";

export type CollectNote = {
  user_id: string;
  class_id: string;
  subject: ClassSubject;
  expect_on: string | null;
  reason: string | null;
};

const db = supabase as unknown as {
  from: (table: string) => {
    select: (cols: string) => Promise<{ data: CollectNote[] | null; error: { message: string } | null }>;
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function raise(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function collectNoteKey(userId: string, classId: string, subject: ClassSubject): string {
  return `${userId}:${classId}:${subject}`;
}

export async function listCollectNotes(): Promise<CollectNote[]> {
  const { data, error } = await db
    .from("payment_collect_notes")
    .select("user_id,class_id,subject,expect_on,reason");
  raise(error);
  return data ?? [];
}

export async function saveCollectNote(note: CollectNote): Promise<void> {
  const { error } = await db.from("payment_collect_notes").upsert(
    {
      user_id: note.user_id,
      class_id: note.class_id,
      subject: note.subject,
      expect_on: note.expect_on || null,
      reason: note.reason?.trim() ? note.reason.trim() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,class_id,subject" },
  );
  raise(error);
}
