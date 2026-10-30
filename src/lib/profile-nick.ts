import { supabase } from "@/integrations/supabase/client";

type NickRow = { nick: string };

type NickTable = {
  from: (table: "profile_nicks") => {
    select: (columns: "nick") => {
      eq: (
        column: "user_id",
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: NickRow | null; error: { message: string } | null }>;
      };
    };
    upsert: (
      row: { user_id: string; nick: string },
      options: { onConflict: "user_id" },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

const nicks = supabase as unknown as NickTable;

export function trimNick(nick: string): string {
  return nick.trim().slice(0, 32);
}

export async function loadNick(userId: string): Promise<string> {
  const { data, error } = await nicks.from("profile_nicks").select("nick").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.nick ?? "";
}

export async function saveNick(userId: string, nick: string): Promise<void> {
  const { error } = await nicks
    .from("profile_nicks")
    .upsert({ user_id: userId, nick: trimNick(nick) }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
