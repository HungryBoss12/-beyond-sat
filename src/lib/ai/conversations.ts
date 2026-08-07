import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { messageImage, messageText, type ChatMessage } from "./client";
import { DEFAULT_CHAT_MODEL, resolveChatModelChoice, type ChatModelChoice } from "./router";

/**
 * Storage for the Beyond AI chat list (supabase/BEYOND_AI_CHATS.sql).
 *
 * RLS scopes every table to `auth.uid() = user_id`, so these queries never filter
 * by user themselves — the one exception is INSERT, which has to supply
 * `user_id` for the `WITH CHECK` to pass.
 */

/**
 * `ai_conversations` and `ai_messages` are created by a hand-run script, so they
 * are absent from the generated `Database` type in integrations/supabase/types.ts
 * and every `.from("ai_…")` call would fail to typecheck against it.
 *
 * Declaring them here rather than editing that generated file: a regeneration
 * would drop the addition silently, and the next person would be left with a
 * type error whose cause is invisible. This keeps the whole escape hatch in the
 * one module that touches these tables — the shapes below are the contract, and
 * if BEYOND_AI_CHATS.sql changes this is the single place that has to follow.
 */
type AiChatsDb = {
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          model_choice: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          model_choice?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { title?: string; model_choice?: string; updated_at?: string };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content?: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: { content?: string; image_url?: string | null };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

const db = supabase as unknown as SupabaseClient<AiChatsDb>;

export type Conversation = {
  id: string;
  title: string;
  model: ChatModelChoice;
  updatedAt: string;
};

type ConversationRow = {
  id: string;
  title: string;
  model_choice: string;
  updated_at: string;
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    // A slug retired from CHAT_MODELS would otherwise leave a stored chat
    // pointing at nothing; the picker falls back the same way the server does.
    model: resolveChatModelChoice(row.model_choice),
    updatedAt: row.updated_at,
  };
}

/** Newest first — the order the sidebar shows and `idx_ai_conversations_user` walks. */
export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await db
    .from("ai_conversations")
    .select("id, title, model_choice, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toConversation);
}

export async function createConversation(
  model: ChatModelChoice = DEFAULT_CHAT_MODEL,
): Promise<Conversation> {
  const uid = await currentUserId();
  const { data, error } = await db
    .from("ai_conversations")
    .insert({ user_id: uid, model_choice: model })
    .select("id, title, model_choice, updated_at")
    .single();
  if (error) throw error;
  return toConversation(data);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  const { error } = await db
    .from("ai_conversations")
    .update({ title: trimmed.slice(0, 120) })
    .eq("id", id);
  if (error) throw error;
}

export async function setConversationModel(id: string, model: ChatModelChoice): Promise<void> {
  const { error } = await db.from("ai_conversations").update({ model_choice: model }).eq("id", id);
  if (error) throw error;
}

/** `ai_messages` cascades on the FK, so the turns go with it. */
export async function deleteConversation(id: string): Promise<void> {
  const { error } = await db.from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("ai_messages")
    .select("role, content, image_url")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    role: row.role,
    content: row.image_url
      ? [
          { type: "text" as const, text: row.content },
          { type: "image_url" as const, image_url: { url: row.image_url } },
        ]
      : row.content,
  }));
}

/**
 * Stores one turn. The image is split out of the content array into `image_url`
 * so the text column stays searchable and a row without an attachment stays
 * small — `loadMessages` reassembles the two-part shape the model expects.
 *
 * `updated_at` on the parent is bumped so the sidebar reorders; the trigger only
 * fires on UPDATE, and inserting a child is not one.
 */
export async function appendMessage(conversationId: string, message: ChatMessage): Promise<void> {
  const uid = await currentUserId();
  const { error } = await db.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: uid,
    role: message.role,
    content: messageText(message.content),
    image_url: messageImage(message.content),
  });
  if (error) throw error;
  await db
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/**
 * A readable sidebar entry without asking the student to name anything.
 *
 * Cut at a word boundary rather than mid-word, and the analysis page's stats
 * preamble is stripped first — a list of chats all titled "Context about me —"
 * is no list at all.
 */
export function deriveTitle(text: string): string {
  const cleaned = text
    .replace(/^Context(?: about me)? —[^\n]*\n*/i, "")
    .replace(/^My current stats —[^\n]*\n*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "New chat";
  if (cleaned.length <= 48) return cleaned;
  const cut = cleaned.slice(0, 48);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 24 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}
