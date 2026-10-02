import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import {
  deleteMessage,
  displayName,
  editMessage,
  getChatProfile,
  listClassThreads,
  listThreadMessages,
  SUBJECT_LABEL,
  type ChatAttachment,
  type ChatMessage,
  type ChatProfile,
  type ChatThread,
  type ClassSubject,
} from "@/lib/classes";
import { CLASS_CONTROL } from "./control";

/** The sub-class chat (subject thread) plus the class-wide thread. */
export function ChatPanel({ classId, subject }: { classId: string; subject: ClassSubject }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ChatProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setActiveId(null);
      try {
        const rows = (await listClassThreads(classId))
          .filter(
            (t) =>
              t.kind === "class_group" || (t.kind === "subject_group" && t.subject === subject),
          )
          .sort(
            (a, b) => (a.kind === "subject_group" ? -1 : 0) - (b.kind === "subject_group" ? -1 : 0),
          );
        setThreads(rows);
        if (rows.length) setActiveId(rows[0]!.id);
      } finally {
        setLoading(false);
      }
    })();
  }, [classId, subject]);

  const reloadMessages = useCallback(async (threadId: string) => {
    const { messages: msgs, attachments: files } = await listThreadMessages(threadId, 120, {
      includeDeleted: true,
    });
    setMessages(msgs);
    setAttachments(files);
    const ids = [...new Set(msgs.map((m) => m.sender_id))];
    const map = new Map<string, ChatProfile>();
    for (const id of ids) {
      const profile = await getChatProfile(id).catch(() => null);
      if (profile) map.set(id, profile);
    }
    setProfiles((prev) => new Map([...prev, ...map]));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void reloadMessages(activeId).catch(() => {});
    const timer = window.setInterval(() => void reloadMessages(activeId).catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, [activeId, reloadMessages]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-[180px_1fr]">
      <ul className="overflow-hidden rounded-xl border border-brand-400/40">
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => {
                setActiveId(thread.id);
                setEditingId(null);
              }}
              className={
                "tap flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold hover:bg-brand-500 " +
                (thread.id === activeId ? "bg-brand-500" : "")
              }
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-white" />
              {thread.kind === "subject_group" && thread.subject
                ? `${SUBJECT_LABEL[thread.subject]} sub-class`
                : thread.kind === "class_group"
                  ? "Whole class"
                  : thread.title}
            </button>
          </li>
        ))}
        {threads.length === 0 && (
          <li className="px-3 py-4 text-sm text-white">No class threads yet.</li>
        )}
      </ul>
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-brand-400/40 p-3">
        {messages.map((message) => {
          const sender = profiles.get(message.sender_id);
          const deleted = Boolean(message.deleted_at);
          return (
            <div
              key={message.id}
              className={
                "rounded-lg bg-brand-800 px-3 py-2 text-sm " + (deleted ? "opacity-60" : "")
              }
            >
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {sender ? displayName(sender) : message.sender_id.slice(0, 8)}
              </div>
              {deleted ? (
                <div className="italic text-white">Message deleted</div>
              ) : editingId === message.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={2}
                    className={CLASS_CONTROL}
                  />
                  <button
                    type="button"
                    className="btn-brand rounded bg-brand-400 px-2 py-1 text-[11px] font-bold"
                    onClick={() => {
                      void (async () => {
                        await editMessage(message.id, editDraft.trim());
                        setEditingId(null);
                        if (activeId) await reloadMessages(activeId);
                      })();
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div className="whitespace-pre-wrap">{message.body}</div>
                  {attachments
                    .filter((file) => file.message_id === message.id)
                    .map((file) => (
                      <div key={file.id} className="mt-1 text-xs text-white">
                        Attachment: {file.file_name}
                      </div>
                    ))}
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase text-white"
                      onClick={() => {
                        setEditingId(message.id);
                        setEditDraft(message.body);
                      }}
                    >
                      <Pencil className="h-2.5 w-2.5" /> Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase text-white"
                      onClick={() => {
                        if (!confirm("Delete this message?")) return;
                        void (async () => {
                          await deleteMessage(message.id);
                          if (activeId) await reloadMessages(activeId);
                        })();
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {activeId && messages.length === 0 && (
          <p className="text-sm text-white">No messages yet.</p>
        )}
      </div>
    </div>
  );
}
