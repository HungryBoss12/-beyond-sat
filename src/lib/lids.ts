import { supabase } from "@/integrations/supabase/client";

export type LidStatus = "inquiry" | "contact" | "in_progress" | "enrolled";

export const LID_COLUMNS: { status: LidStatus; label: string }[] = [
  { status: "inquiry", label: "So'rov" },
  { status: "contact", label: "Bog'lanish kerak" },
  { status: "in_progress", label: "Jarayonda" },
  { status: "enrolled", label: "Darsga yozildi" },
];

export type Lid = {
  id: string;
  full_name: string;
  phone: string;
  wanted_class: string;
  note: string | null;
  status: LidStatus;
  created_at: string;
};

const FORM_KEY = "lids_google_form_url";

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function raise(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function listLids(): Promise<Lid[]> {
  const { data, error } = await db
    .from("lids")
    .select("id,full_name,phone,wanted_class,note,status,created_at")
    .order("created_at");
  raise(error);
  return (data ?? []) as Lid[];
}

export async function saveLid(input: {
  id?: string | null;
  fullName: string;
  phone: string;
  wantedClass: string;
  note?: string;
}): Promise<void> {
  const { error } = await db.rpc("admin_save_lid", {
    p_id: input.id ?? null,
    p_name: input.fullName,
    p_phone: input.phone,
    p_class: input.wantedClass,
    p_note: input.note ?? null,
  });
  raise(error);
}

export async function setLidStatus(id: string, status: LidStatus): Promise<void> {
  const { error } = await db.rpc("admin_set_lid_status", { p_id: id, p_status: status });
  raise(error);
}

export async function deleteLid(id: string): Promise<void> {
  const { error } = await db.from("lids").delete().eq("id", id);
  raise(error);
}

export async function loadLidsFormUrl(): Promise<string> {
  const { data, error } = await db.from("app_settings").select("value").eq("key", FORM_KEY).maybeSingle();
  raise(error);
  return typeof data?.value === "string" ? data.value : "";
}

export async function saveLidsFormUrl(url: string): Promise<void> {
  const { error } = await db.from("app_settings").upsert({ key: FORM_KEY, value: url.trim() }, { onConflict: "key" });
  raise(error);
}
