import { supabase } from "@/integrations/supabase/client";
import type { ClassSubject } from "@/lib/classes/types";

/** The center is in Tashkent, which does not use daylight saving. */
const TASHKENT_OFFSET = "+05:00";

export type SupportStatus = "pending" | "confirmed" | "rejected" | "completed";

export type SupportMaterial = {
  id: string;
  title: string;
  material_url: string | null;
  test_id: string | null;
};

export type SupportSession = {
  id: string;
  student_id?: string;
  teacher_id: string;
  student_name?: string;
  teacher_name: string;
  subject: ClassSubject;
  starts_at: string;
  ends_at: string;
  status: SupportStatus;
  notes: string | null;
  rejection_reason: string | null;
  slot_id?: string;
  materials: SupportMaterial[];
};

export type OpenSlot = {
  slot_id: string;
  teacher_id: string;
  teacher_name: string;
  starts_at: string;
  ends_at: string;
};

export type CenterHours = { opens_at: string; closes_at: string };

// Group RPCs and tables ship ahead of regenerated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => any;
};

function raise(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** `2026-10-11T15:00` from a datetime-local input, read as Tashkent time. */
export function tashkentInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}${TASHKENT_OFFSET}`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function subjectLabel(subject: ClassSubject): string {
  return subject === "math" ? "Math" : "English";
}

export async function loadCenterHours(): Promise<CenterHours | null> {
  const { data, error } = await db.from("support_center_hours").select("opens_at,closes_at").limit(1).maybeSingle();
  raise(error);
  return (data as CenterHours | null) ?? null;
}

export async function saveCenterHours(opens: string, closes: string): Promise<void> {
  const { error } = await db.rpc("admin_set_support_hours", { p_opens: opens, p_closes: closes });
  raise(error);
}

export async function loadOpenSlots(): Promise<OpenSlot[]> {
  const { data, error } = await db.rpc("support_open_slots");
  raise(error);
  return (data ?? []) as OpenSlot[];
}

export async function loadMySessions(): Promise<SupportSession[]> {
  const { data, error } = await db.rpc("support_my_sessions");
  raise(error);
  return (data ?? []) as SupportSession[];
}

export async function loadStaffSessions(): Promise<SupportSession[]> {
  const { data, error } = await db.rpc("support_staff_sessions");
  raise(error);
  return (data ?? []) as SupportSession[];
}

export async function requestSupport(slotId: string, subject: ClassSubject, notes: string): Promise<void> {
  const { error } = await db.rpc("student_request_support", {
    p_slot_id: slotId,
    p_subject: subject,
    p_notes: notes.trim() || null,
  });
  raise(error);
}

export async function addSupportSlot(start: string, end: string): Promise<void> {
  const { error } = await db.rpc("teacher_add_support_slot", {
    p_start: tashkentInput(start),
    p_end: tashkentInput(end),
    p_teacher_id: null,
  });
  raise(error);
}

export async function deleteSupportSlot(slotId: string): Promise<void> {
  const { error } = await db.rpc("teacher_delete_support_slot", { p_slot_id: slotId });
  raise(error);
}

export async function decideSupport(sessionId: string, accept: boolean, reason: string): Promise<void> {
  const { error } = await db.rpc("teacher_decide_support", {
    p_session_id: sessionId,
    p_accept: accept,
    p_reason: reason.trim() || null,
  });
  raise(error);
}

export async function completeSupport(sessionId: string): Promise<void> {
  const { error } = await db.rpc("teacher_complete_support", { p_session_id: sessionId });
  raise(error);
}

export async function addSupportMaterial(input: {
  sessionId: string;
  title: string;
  url?: string;
  testId?: string;
}): Promise<void> {
  const { error } = await db.rpc("teacher_add_support_material", {
    p_session_id: input.sessionId,
    p_title: input.title,
    p_url: input.url ?? null,
    p_test_id: input.testId || null,
  });
  raise(error);
}

export type SupportSlotRow = {
  id: string;
  teacher_id: string;
  starts_at: string;
  ends_at: string;
};

export async function loadOwnSlots(): Promise<SupportSlotRow[]> {
  const { data, error } = await db
    .from("teacher_availability_slots")
    .select("id,teacher_id,starts_at,ends_at")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  raise(error);
  return (data ?? []) as SupportSlotRow[];
}

export async function loadPublishedTests(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await db
    .from("tests")
    .select("id,title")
    .eq("published", true)
    .order("title")
    .limit(80);
  raise(error);
  return (data ?? []) as { id: string; title: string }[];
}
