import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type LabelHTMLAttributes,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  Download,
  FilePlus2,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { getStaffRole } from "@/lib/admin";
import { AmbientGlow, RevealCard } from "@/components/ui/reveal-card";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { cn } from "@/lib/utils";
import {
  displayName,
  getChatProfile,
  getDirectPeerProfiles,
  getMySubmission,
  listHomework,
  listHomeworkFiles,
  listMyThreads,
  listThreadMessages,
  openDirectThread,
  searchUsersByUsername,
  sendMessage,
  editMessage,
  deleteMessage,
  amIMutedInThread,
  downloadStorageFile,
  upsertSubmission,
  addSubmissionFiles,
  uploadChatFile,
  uploadHomeworkFile,
  SUBJECT_LABEL,
  type ChatAttachment,
  type ChatMessage,
  type ChatProfile,
  type ChatThread,
  type ClassSubject,
  type HomeworkAssignment,
  type HomeworkFile,
  type HomeworkSubmission,
} from "@/lib/classes";

export const Route = createFileRoute("/_authenticated/classes")({
  component: ClassesPage,
  head: () => ({ meta: [{ title: "Classes — BeyondSAT" }] }),
});

type Tab = "chats" | "homeworks";

/** Cursor-lit control — same reveal wash as dashboard cards, for buttons. */
function RevealButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = usePointerGlow<HTMLButtonElement>();
  return <button ref={ref} className={cn("reveal-surface", className)} {...props} />;
}

function RevealLabel({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  const ref = usePointerGlow<HTMLLabelElement>();
  return (
    <label ref={ref} className={cn("reveal-surface", className)} {...props}>
      {children}
    </label>
  );
}

function ClassesPage() {
  const [tab, setTab] = useState<Tab>("chats");
  const [me, setMe] = useState<ChatProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getChatProfile();
        setMe(profile);
        if (!profile?.chat_setup_completed || !profile.class_id) {
          setErr("Finish your Classes setup on Profile first.");
        }
      } catch (e) {
        setErr((e as Error)?.message ?? "Could not load Classes.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative isolate flex h-[100dvh] flex-col bg-brand-900 text-white">
      <AmbientGlow />
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-brand-400/30 bg-brand-600 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/dashboard"
            className="tap grid h-9 w-9 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
            aria-label="Exit Classes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="truncate text-sm font-black tracking-tight">Classes</div>
            <div className="truncate text-[10px] font-bold uppercase tracking-wider text-brand-100">
              {me?.username ? `@${me.username}` : "Chats & homework"}
            </div>
          </div>
        </div>
        <div className="relative grid grid-cols-2 rounded-lg bg-brand-800 p-1 ring-1 ring-brand-400/40">
          <span
            aria-hidden
            className="nav-tab-pill pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-brand-400"
            style={{
              transform: tab === "chats" ? "translateX(0)" : "translateX(calc(100% + 0.25rem))",
            }}
          />
          {(
            [
              ["chats", "Chats", MessageSquare],
              ["homeworks", "Homeworks", BookOpen],
            ] as const
          ).map(([id, label, Icon]) => (
            <RevealButton
              key={id}
              onClick={() => setTab(id)}
              className={
                "relative z-10 tap inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold transition-colors duration-200 " +
                (tab === id ? "text-white" : "text-brand-100 hover:text-white")
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </RevealButton>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="grid flex-1 place-items-center text-sm text-brand-100">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : err && (!me?.class_id || !me.chat_setup_completed) ? (
        <div className="grid flex-1 place-items-center p-6">
          <RevealCard className="max-w-sm rounded-2xl border border-brand-400/40 bg-brand-600 p-6 text-center shadow-panel">
            <p className="text-sm text-brand-100">{err}</p>
            <Link
              to="/profile"
              className="btn-brand mt-4 inline-flex rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
            >
              Open Profile
            </Link>
          </RevealCard>
        </div>
      ) : tab === "chats" ? (
        <ChatsPane me={me!} />
      ) : (
        <HomeworksPane classId={me!.class_id!} />
      )}
    </div>
  );
}

function ChatsPane({ me }: { me: ChatProfile }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [peers, setPeers] = useState<Map<string, ChatProfile>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ChatProfile>>(new Map());
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ChatProfile[]>([]);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [muted, setMuted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    byte_size: number | null;
  } | null>(null);

  useEffect(() => {
    void getStaffRole(me.id).then((r) => setIsStaff(Boolean(r)));
  }, [me.id]);

  const reloadThreads = useCallback(async () => {
    const rows = await listMyThreads();
    setThreads(rows);
    const directs = rows.filter((t) => t.kind === "direct").map((t) => t.id);
    setPeers(await getDirectPeerProfiles(directs));
  }, []);

  useEffect(() => {
    void reloadThreads().catch(() => {});
    const t = window.setInterval(() => void reloadThreads().catch(() => {}), 12000);
    return () => window.clearInterval(t);
  }, [reloadThreads]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    async function load() {
      const [{ messages: msgs, attachments: atts }, amMuted] = await Promise.all([
        listThreadMessages(activeId!, 80, { includeDeleted: isStaff }),
        amIMutedInThread(activeId!).catch(() => false),
      ]);
      if (cancelled) return;
      setMessages(msgs);
      setAttachments(atts);
      setMuted(amMuted);
      const ids = [...new Set(msgs.map((m) => m.sender_id))];
      const map = new Map(profiles);
      for (const id of ids) {
        if (!map.has(id)) {
          const p = await getChatProfile(id).catch(() => null);
          if (p) map.set(id, p);
        }
      }
      map.set(me.id, me);
      setProfiles(new Map(map));
    }
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, me.id, isStaff]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchUsersByUsername(q)
        .then((rows) => setHits(rows.filter((r) => r.id !== me.id)))
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(t);
  }, [search, me.id]);

  async function openThread(id: string) {
    setActiveId(id);
    setDraft("");
    setPendingFile(null);
    setEditingId(null);
  }

  async function startDm(user: ChatProfile) {
    setBusy(true);
    try {
      const id = await openDirectThread(user.id);
      await reloadThreads();
      setActiveId(id);
      setSearch("");
      setHits([]);
    } catch (e) {
      alert((e as Error)?.message ?? "Could not open chat.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!activeId || sending || muted) return;
    const text = draft.trim();
    if (!text && !pendingFile) return;
    setSending(true);
    try {
      await sendMessage(
        activeId,
        text || (pendingFile ? pendingFile.file_name : ""),
        pendingFile ? [pendingFile] : undefined,
      );
      setDraft("");
      setPendingFile(null);
      const { messages: msgs, attachments: atts } = await listThreadMessages(activeId, 80, {
        includeDeleted: isStaff,
      });
      setMessages(msgs);
      setAttachments(atts);
      await reloadThreads();
    } catch (e) {
      alert((e as Error)?.message ?? "Send failed.");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(id: string) {
    const body = editDraft.trim();
    if (!body) return alert("Message cannot be empty.");
    try {
      await editMessage(id, body);
      setEditingId(null);
      if (activeId) {
        const { messages: msgs, attachments: atts } = await listThreadMessages(activeId, 80, {
          includeDeleted: isStaff,
        });
        setMessages(msgs);
        setAttachments(atts);
      }
    } catch (e) {
      alert((e as Error)?.message ?? "Edit failed.");
    }
  }

  async function removeMessage(id: string) {
    if (!confirm("Delete this message?")) return;
    try {
      await deleteMessage(id);
      if (activeId) {
        const { messages: msgs, attachments: atts } = await listThreadMessages(activeId, 80, {
          includeDeleted: isStaff,
        });
        setMessages(msgs);
        setAttachments(atts);
      }
    } catch (e) {
      alert((e as Error)?.message ?? "Delete failed.");
    }
  }

  const active = threads.find((t) => t.id === activeId) ?? null;
  const attsByMsg = useMemo(() => {
    const m = new Map<string, ChatAttachment[]>();
    for (const a of attachments) {
      const list = m.get(a.message_id) ?? [];
      list.push(a);
      m.set(a.message_id, list);
    }
    return m;
  }, [attachments]);

  function threadTitle(t: ChatThread): string {
    if (t.kind === "direct") {
      const p = peers.get(t.id);
      return p ? displayName(p) : "Direct message";
    }
    if (t.kind === "subject_group" && t.subject) return SUBJECT_LABEL[t.subject];
    return t.title;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={
          "flex min-h-0 w-full shrink-0 flex-col border-r border-brand-400/30 bg-brand-600 md:max-w-xs lg:max-w-sm " +
          (activeId ? "hidden md:flex" : "flex")
        }
      >
        <div className="border-b border-brand-400/30 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-200" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats or usernames…"
              className="w-full rounded-lg border border-brand-400/40 bg-brand-800 py-2 pl-9 pr-3 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
            />
          </div>
          {hits.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-brand-400/40 bg-brand-800">
              {hits.map((h) => (
                <li key={h.id}>
                  <RevealButton
                    disabled={busy}
                    onClick={() => void startDm(h)}
                    className="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-500"
                  >
                    <span className="font-bold">@{h.username}</span>
                    <span className="truncate text-xs text-brand-100">{h.full_name}</span>
                  </RevealButton>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id}>
              <RevealButton
                onClick={() => void openThread(t.id)}
                className={
                  "tap flex w-full items-center gap-2 border-b border-brand-400/20 px-3 py-3 text-left hover:bg-brand-500 " +
                  (t.id === activeId ? "bg-brand-500" : "")
                }
              >
                <span
                  className={
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-black " +
                    (t.kind === "subject_group"
                      ? "bg-brand-400 text-white"
                      : t.kind === "class_group"
                        ? "bg-brand-800 text-brand-100"
                        : "bg-brand-800 text-white")
                  }
                >
                  {t.kind === "subject_group" && t.subject === "math"
                    ? "M"
                    : t.kind === "subject_group"
                      ? "E"
                      : t.kind === "class_group"
                        ? "C"
                        : "DM"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{threadTitle(t)}</span>
                  <span className="block truncate text-[11px] text-brand-100">
                    {t.kind === "subject_group"
                      ? "Subject group"
                      : t.kind === "class_group"
                        ? "Class group"
                        : "Private"}
                  </span>
                </span>
              </RevealButton>
            </li>
          ))}
          {threads.length === 0 && (
            <li className="p-4 text-sm text-brand-100">
              No chats yet. Join a class to get Maths & EBRW groups.
            </li>
          )}
        </ul>
      </aside>

      <section
        className={"min-w-0 flex-1 flex-col bg-brand-900 " + (activeId ? "flex" : "hidden md:flex")}
      >
        {!active ? (
          <div className="grid flex-1 place-items-center text-sm text-brand-200">
            Select a chat or search a username to message
          </div>
        ) : (
          <>
            <div className="flex h-12 items-center gap-2 border-b border-brand-400/30 bg-brand-600 px-3 text-sm font-bold md:px-4">
              <RevealButton
                type="button"
                className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 md:hidden"
                onClick={() => setActiveId(null)}
                aria-label="Back to chats"
              >
                <ArrowLeft className="h-4 w-4" />
              </RevealButton>
              {threadTitle(active)}
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.sender_id === me.id;
                const canMod = mine || isStaff;
                const sender = profiles.get(m.sender_id);
                const files = attsByMsg.get(m.id) ?? [];
                const deleted = Boolean(m.deleted_at);
                return (
                  <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                    <RevealCard
                      className={
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
                        (mine ? "bg-brand-400 text-white" : "bg-brand-600 text-white") +
                        (deleted ? " opacity-60" : "")
                      }
                    >
                      {!mine && (
                        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                          {sender ? displayName(sender) : "…"}
                        </div>
                      )}
                      {deleted ? (
                        <div className="italic text-brand-100">Message deleted</div>
                      ) : editingId === m.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-brand-400/40 bg-brand-800 px-2 py-1.5 text-sm text-white focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEdit(m.id)}
                              className="rounded bg-brand-800 px-2 py-1 text-[11px] font-bold"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded px-2 py-1 text-[11px] font-bold text-brand-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                          {files.map((f) => (
                            <button
                              key={f.id}
                              className="mt-1 flex items-center gap-1 text-xs font-semibold underline"
                              onClick={() =>
                                void downloadStorageFile(
                                  "chat-uploads",
                                  f.storage_path,
                                  f.file_name,
                                ).catch((err) =>
                                  alert((err as Error)?.message ?? "Download failed."),
                                )
                              }
                            >
                              <Paperclip className="h-3 w-3" />
                              {f.file_name}
                            </button>
                          ))}
                          {m.edited_at && (
                            <div className="mt-0.5 text-[10px] text-brand-100/80">edited</div>
                          )}
                          {canMod && (
                            <div className="mt-1 flex gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100 hover:text-white"
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditDraft(m.body);
                                }}
                              >
                                <Pencil className="h-2.5 w-2.5" /> Edit
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100 hover:text-white"
                                onClick={() => void removeMessage(m.id)}
                              >
                                <Trash2 className="h-2.5 w-2.5" /> Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </RevealCard>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-brand-400/30 bg-brand-600 p-3">
              {muted && (
                <div className="mb-2 rounded-lg bg-brand-900/60 px-3 py-2 text-xs font-semibold text-brand-100">
                  You are muted in this chat and cannot send messages.
                </div>
              )}
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 text-xs text-brand-100">
                  <Paperclip className="h-3.5 w-3.5" />
                  {pendingFile.file_name}
                  <RevealButton onClick={() => setPendingFile(null)} className="ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </RevealButton>
                </div>
              )}
              <div className="flex items-end gap-2">
                <RevealButton
                  onClick={() => fileRef.current?.click()}
                  disabled={muted}
                  className="tap grid h-10 w-10 place-items-center rounded-lg bg-brand-800 text-brand-100 hover:text-white disabled:opacity-40"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </RevealButton>
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void uploadChatFile(f)
                      .then(setPendingFile)
                      .catch((err) => alert(err.message));
                    e.target.value = "";
                  }}
                />
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={1}
                  disabled={muted}
                  placeholder={muted ? "Muted…" : "Message…"}
                  className="min-h-10 min-w-0 flex-1 resize-none rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none disabled:opacity-40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
                <RevealButton
                  onClick={() => void submit()}
                  disabled={sending || muted}
                  className="btn-brand grid h-10 w-10 place-items-center rounded-lg bg-brand-400 text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </RevealButton>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function HomeworksPane({ classId }: { classId: string }) {
  const [subject, setSubject] = useState<ClassSubject | "all">("all");
  const [items, setItems] = useState<HomeworkAssignment[]>([]);
  const [files, setFiles] = useState<HomeworkFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [active, setActive] = useState<HomeworkAssignment | null>(null);
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const rows = await listHomework(classId, subject === "all" ? undefined : subject);
      setItems(rows);
      setFiles(await listHomeworkFiles(rows.map((r) => r.id)));
    } catch (e) {
      setLoadErr((e as Error)?.message ?? "Could not load homework.");
    } finally {
      setLoading(false);
    }
  }, [classId, subject]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openAssignment(a: HomeworkAssignment) {
    setActive(a);
    setSubmission(await getMySubmission(a.id));
    setNote("");
  }

  async function submitMakeup() {
    if (!active) return;
    setUploading(true);
    try {
      const sub = await upsertSubmission({ assignment_id: active.id, note });
      setSubmission(sub);
      alert("Submission saved. Attach photos if you missed class.");
    } catch (e) {
      alert((e as Error)?.message ?? "Could not submit.");
    } finally {
      setUploading(false);
    }
  }

  async function attachPhotos(fileList: FileList | null) {
    if (!active || !fileList?.length) return;
    setUploading(true);
    try {
      const sub = submission ?? (await upsertSubmission({ assignment_id: active.id, note }));
      const uploaded = [];
      for (const file of Array.from(fileList)) {
        uploaded.push(await uploadHomeworkFile(file));
      }
      await addSubmissionFiles(sub.id, uploaded);
      setSubmission(await getMySubmission(active.id));
    } catch (e) {
      alert((e as Error)?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const filesFor = (id: string) => files.filter((f) => f.assignment_id === id);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "math", "ebrw"] as const).map((s) => (
          <RevealButton
            key={s}
            onClick={() => setSubject(s)}
            className={
              "tap rounded-lg px-3 py-1.5 text-xs font-bold " +
              (subject === s ? "bg-brand-400 text-white" : "bg-brand-600 text-brand-100")
            }
          >
            {s === "all" ? "All" : SUBJECT_LABEL[s]}
          </RevealButton>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-brand-100">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading homework…
        </div>
      ) : loadErr ? (
        <RevealCard className="rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center text-sm text-brand-100 shadow-panel">
          {loadErr}
          <RevealButton
            type="button"
            onClick={() => void reload()}
            className="tap mt-3 rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-bold text-white"
          >
            Try again
          </RevealButton>
        </RevealCard>
      ) : items.length === 0 ? (
        <RevealCard className="rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center text-sm text-brand-100 shadow-panel">
          No homework yet for your class.
        </RevealCard>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <RevealCard
              key={a.id}
              as="li"
              className="lift rounded-2xl border border-brand-400/40 bg-brand-600 p-4 shadow-panel"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-brand-100">
                    {SUBJECT_LABEL[a.subject]}
                    {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ""}
                  </div>
                  <h3 className="mt-1 text-base font-black">{a.title}</h3>
                  {a.body && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-brand-100">{a.body}</p>
                  )}
                </div>
                <RevealButton
                  onClick={() => void openAssignment(a)}
                  className="tap rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-brand-400/40 hover:bg-brand-400"
                >
                  Open
                </RevealButton>
              </div>
              {filesFor(a.id).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {filesFor(a.id).map((f) => (
                    <RevealButton
                      key={f.id}
                      onClick={() =>
                        void downloadStorageFile(
                          "homework-uploads",
                          f.storage_path,
                          f.file_name,
                        ).catch((err) => alert((err as Error)?.message ?? "Download failed."))
                      }
                      className="tap inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {f.file_name}
                    </RevealButton>
                  ))}
                </div>
              )}
            </RevealCard>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/70 p-4 backdrop-blur-sm">
          <RevealCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-float">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-100">
                  {SUBJECT_LABEL[active.subject]}
                </div>
                <h3 className="text-lg font-black">{active.title}</h3>
              </div>
              <RevealButton
                onClick={() => setActive(null)}
                className="tap text-brand-100 hover:text-white"
              >
                <X className="h-5 w-5" />
              </RevealButton>
            </div>
            {active.body && (
              <p className="mb-4 whitespace-pre-wrap text-sm text-brand-100">{active.body}</p>
            )}
            <div className="mb-3 space-y-2">
              {filesFor(active.id).map((f) => (
                <RevealButton
                  key={f.id}
                  onClick={() =>
                    void downloadStorageFile("homework-uploads", f.storage_path, f.file_name).catch(
                      (err) => alert((err as Error)?.message ?? "Download failed."),
                    )
                  }
                  className="tap flex w-full items-center gap-2 rounded-lg bg-brand-800 px-3 py-2 text-left text-sm font-semibold"
                >
                  <Download className="h-4 w-4" />
                  Download {f.file_name}
                </RevealButton>
              ))}
            </div>
            <p className="mb-2 text-xs text-brand-100">
              Optional make-up: if you didn&apos;t attend, upload photos of your completed work for
              admins to check.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Note for your teacher (optional)"
              className="mb-3 w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:outline-none"
            />
            {submission && (
              <div className="mb-3 rounded-lg bg-brand-800 px-3 py-2 text-xs text-brand-100">
                Status: <span className="font-bold text-white">{submission.status}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <RevealButton
                onClick={() => void submitMakeup()}
                disabled={uploading}
                className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Save submission
              </RevealButton>
              <RevealLabel className="tap inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-bold text-white ring-1 ring-brand-400/40">
                <FilePlus2 className="h-4 w-4" />
                Upload photos
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => void attachPhotos(e.target.files)}
                />
              </RevealLabel>
            </div>
          </RevealCard>
        </div>
      )}
    </div>
  );
}
