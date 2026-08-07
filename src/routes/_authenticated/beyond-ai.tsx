import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ImagePlus,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { ChatTurn } from "@/components/ai/ChatTurn";
import { messageText, useBeyondAi, type ChatMessage } from "@/lib/ai/client";
import { ACCEPTED_IMAGE_TYPES, imageFromFiles, prepareAttachment } from "@/lib/ai/attachment";
import {
  appendMessage,
  createConversation,
  deleteConversation,
  deriveTitle,
  listConversations,
  loadMessages,
  renameConversation,
  setConversationModel,
  type Conversation,
} from "@/lib/ai/conversations";
import { loadAiContext } from "@/lib/ai/context";
import {
  CHAT_MODEL_CHOICES,
  DEFAULT_CHAT_MODEL,
  VISION_CHAT_MODEL,
  type ChatModelChoice,
} from "@/lib/ai/router";

/**
 * The Beyond AI section (/beyond-ai).
 *
 * Renders bare — outside AppShell — for the same reason the test runner does: a
 * full-height two-pane layout inside AppShell's `route-enter` wrapper would sit
 * under the app header, be boxed in by its `max-w-7xl px-4 py-6` container, and
 * inherit an animated-transform ancestor. So the route owns its own back link.
 *
 * The height chain is `h-[100dvh]` at the root with `min-h-0` on every flex
 * ancestor of the transcript. Without `min-h-0` a flex child refuses to shrink
 * below its content and the composer is pushed off the bottom of the screen.
 */

export const Route = createFileRoute("/_authenticated/beyond-ai")({
  component: BeyondAiPage,
  head: () => ({ meta: [{ title: "Beyond AI — BeyondSAT" }] }),
});

const QUICK_PROMPTS = [
  "What should I work on next?",
  "Explain a question I got wrong",
  "Give me a hard algebra problem",
  "How do I manage time on Reading?",
];

function BeyondAiPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<ChatModelChoice>(DEFAULT_CHAT_MODEL);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  /* The active conversation as of the moment a turn is sent. `onTurn` fires from
     inside the stream, where the state variable would be the closure's snapshot. */
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;
  /* The student's own numbers, prepended to their first message only. Sent as
     part of the user turn, never as a system instruction — the system prompt is
     assembled server-side and must stay out of the client's reach. */
  const contextRef = useRef<string | null>(null);
  const sentContext = useRef(false);

  const persist = useCallback((turn: { user: ChatMessage; assistant: string }) => {
    const id = activeRef.current;
    if (!id) return;
    void (async () => {
      try {
        await appendMessage(id, turn.user);
        await appendMessage(id, { role: "assistant", content: turn.assistant });
        // The first user message names the chat, so the sidebar is readable
        // without the student titling anything.
        setConversations((current) => {
          const existing = current.find((c) => c.id === id);
          if (existing && existing.title === "New chat") {
            const title = deriveTitle(messageText(turn.user.content));
            void renameConversation(id, title);
            return current.map((c) => (c.id === id ? { ...c, title } : c));
          }
          return current;
        });
      } catch {
        setSaveError("This chat couldn't be saved. The reply above is still fine to read.");
      }
    })();
  }, []);

  const { messages, streaming, error, send, stop, load } = useBeyondAi({
    model,
    // A full page has room, so `quick`'s fixed-height-card token cap is lifted.
    surface: "page",
    onTurn: persist,
  });

  useEffect(() => {
    void (async () => {
      try {
        setConversations(await listConversations());
      } catch {
        setSaveError("Saved chats couldn't be loaded. You can still start a new one.");
      }
    })();
    void (async () => {
      contextRef.current = await loadAiContext();
    })();
  }, []);

  /* Pin to the bottom as tokens arrive, but only when the student is already near
     it — yanking the view back while they re-read an earlier step is worse than
     letting new text land off-screen. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function openConversation(conversation: Conversation) {
    if (conversation.id === activeId) {
      setDrawerOpen(false);
      return;
    }
    setActiveId(conversation.id);
    activeRef.current = conversation.id;
    setModel(conversation.model);
    setDrawerOpen(false);
    sentContext.current = true; // an existing chat already has its context
    try {
      load(await loadMessages(conversation.id));
    } catch {
      load([]);
      setSaveError("That chat couldn't be opened.");
    }
  }

  function startNewChat() {
    setActiveId(null);
    activeRef.current = null;
    sentContext.current = false;
    setDraft("");
    setAttachment(null);
    setDrawerOpen(false);
    load([]);
  }

  async function handleDelete(id: string) {
    setConversations((current) => current.filter((c) => c.id !== id));
    if (id === activeId) startNewChat();
    try {
      await deleteConversation(id);
    } catch {
      setSaveError("That chat couldn't be deleted.");
    }
  }

  async function handleRename(id: string, title: string) {
    setConversations((current) => current.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await renameConversation(id, title);
    } catch {
      setSaveError("That name couldn't be saved.");
    }
  }

  function chooseModel(next: ChatModelChoice) {
    setModel(next);
    setConversations((current) =>
      current.map((c) => (c.id === activeId ? { ...c, model: next } : c)),
    );
    if (activeId) void setConversationModel(activeId, next).catch(() => {});
  }

  async function attach(file: File) {
    setAttachError(null);
    setPreparing(true);
    try {
      const dataUrl = await prepareAttachment(file);
      setAttachment(dataUrl);
      // A text-only model would guess at a figure rather than read it, and the
      // student has no way to know that's what happened — so the picker moves,
      // visibly, instead of failing quietly.
      if (model !== VISION_CHAT_MODEL) chooseModel(VISION_CHAT_MODEL);
    } catch (err) {
      setAttachError((err as Error)?.message ?? "That image couldn't be attached.");
    } finally {
      setPreparing(false);
    }
  }

  async function submit(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || streaming || preparing) return;

    // Create the row before streaming so `onTurn` has somewhere to write. A chat
    // created up front and then abandoned would leave an empty row in the list.
    let id = activeId;
    if (!id) {
      try {
        const conversation = await createConversation(model);
        id = conversation.id;
        setActiveId(id);
        activeRef.current = id;
        setConversations((current) => [conversation, ...current]);
      } catch {
        setSaveError("This chat won't be saved, but you can still use it.");
      }
    }

    const withContext =
      contextRef.current && !sentContext.current && trimmed
        ? `${contextRef.current}\n\n${trimmed}`
        : trimmed;
    sentContext.current = true;

    const image = attachment ?? undefined;
    setDraft("");
    setAttachment(null);
    setAttachError(null);
    void send(withContext, { imageDataUrl: image, model });
  }

  const empty = messages.length === 0;
  const active = conversations.find((c) => c.id === activeId) ?? null;

  const list = (
    <ConversationList
      conversations={conversations}
      activeId={activeId}
      onOpen={openConversation}
      onDelete={handleDelete}
      onRename={handleRename}
    />
  );

  return (
    <div className="flex h-[100dvh] min-h-0 bg-brand-600 text-white">
      {/* Desktop sidebar. Collapses to a rail rather than disappearing, so the
          new-chat button and the way back are always one click away. */}
      <aside
        className={
          "hidden shrink-0 flex-col border-r border-brand-400/30 bg-brand-900/40 transition-[width] duration-300 md:flex " +
          (sidebarOpen ? "w-72" : "w-16")
        }
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-brand-400/30 px-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Collapse chat list" : "Expand chat list"}
            className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg text-brand-100 transition hover:bg-brand-800 hover:text-white"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </button>
          {sidebarOpen && (
            <span className="truncate text-sm font-black tracking-tight">
              Beyond<span className="text-brand-200">AI</span>
            </span>
          )}
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={startNewChat}
            className="btn-brand flex w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-3 py-2.5 text-sm font-bold text-white"
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0" />
            {sidebarOpen && "New chat"}
          </button>
        </div>

        {sidebarOpen && <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{list}</div>}

        {sidebarOpen && (
          <div className="border-t border-brand-400/30 p-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-brand-100 transition hover:bg-brand-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </div>
        )}
      </aside>

      {/* Mobile drawer, matching AppShell's overlay pattern. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fade-in absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="slide-in absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-600 shadow-float">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-brand-400/30 px-4">
              <span className="text-sm font-black tracking-tight">
                Beyond<span className="text-brand-200">AI</span>
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close chat list"
                className="tap grid h-9 w-9 place-items-center rounded-lg text-brand-100 hover:bg-brand-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3">
              <button
                type="button"
                onClick={startNewChat}
                className="btn-brand flex w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-3 py-2.5 text-sm font-bold text-white"
              >
                <MessageSquarePlus className="h-4 w-4" /> New chat
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{list}</div>
            <div className="border-t border-brand-400/30 p-3">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-brand-100 transition hover:bg-brand-800 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Chat pane */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-brand-400/30 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open chat list"
              className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-400/50 text-white hover:bg-brand-400 md:hidden"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold sm:text-base">
                {active?.title ?? "New chat"}
              </h1>
              <p className="hidden text-[11px] text-brand-100 sm:block">
                Your personal Digital SAT coach
              </p>
            </div>
          </div>
          <ModelPicker value={model} onChange={chooseModel} />
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {empty ? (
              <Welcome onPick={(prompt) => void submit(prompt)} disabled={streaming} />
            ) : (
              messages.map((m, i) => <ChatTurn key={i} role={m.role} content={m.content} />)
            )}

            {error && (
              <p className="rounded-xl bg-brand-800 px-3 py-2.5 text-xs font-semibold ring-1 ring-brand-400/50">
                {error}
              </p>
            )}
            {saveError && (
              <p className="rounded-xl bg-brand-800/60 px-3 py-2.5 text-xs font-semibold text-brand-100 ring-1 ring-brand-400/30">
                {saveError}
              </p>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-brand-400/30 px-3 py-3 sm:px-5">
          <div className="mx-auto max-w-3xl">
            {attachment && (
              <div className="mb-2 inline-flex items-start gap-2 rounded-xl bg-brand-800 p-2 ring-1 ring-brand-400/40">
                <img
                  src={attachment}
                  alt="Attachment preview"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove image"
                  className="tap grid h-7 w-7 place-items-center rounded-lg text-brand-100 hover:bg-brand-700 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {attachError && (
              <p className="mb-2 text-xs font-semibold text-brand-100">{attachError}</p>
            )}

            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(draft);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void attach(file);
                  // Reset so picking the same file twice still fires onChange.
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={preparing}
                aria-label="Attach an image"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-800 text-white ring-1 ring-brand-400/50 transition hover:bg-brand-700 disabled:opacity-60"
              >
                <ImagePlus className="h-4 w-4" />
              </button>

              <label className="sr-only" htmlFor="beyond-ai-input">
                Message Beyond AI
              </label>
              <textarea
                id="beyond-ai-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                // Enter sends, Shift+Enter breaks the line — chat convention, and
                // the textarea exists for multi-line question text.
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(draft);
                  }
                }}
                // Pasting a screenshot is how a student actually attaches a
                // question, so it must not require finding the button first.
                onPaste={(e) => {
                  const file = imageFromFiles(e.clipboardData?.files);
                  if (file) {
                    e.preventDefault();
                    void attach(file);
                  }
                }}
                rows={1}
                placeholder={preparing ? "Preparing image…" : "Ask anything about the SAT…"}
                className="max-h-40 min-h-[2.75rem] flex-1 resize-y rounded-xl border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
              />

              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Stop generating"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-800 text-white ring-1 ring-brand-400/50 transition hover:bg-brand-700"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={(!draft.trim() && !attachment) || preparing}
                  aria-label="Send"
                  className="btn-brand grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-400 text-white disabled:opacity-50"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </form>
            <p className="mt-2 text-center text-[11px] text-brand-200">
              Beyond AI can make mistakes — check anything that decides an answer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Welcome({ onPick, disabled }: { onPick: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="rise-in py-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-400 shadow-brand">
        <Sparkles className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-xl font-black tracking-tight sm:text-2xl">
        What are we working on?
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-brand-100">
        Ask about a question you missed, a concept that isn't sticking, or what to study next.
        Attach a photo of a question and it'll read it. Answers come back with full working, and
        maths is properly typeset.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            disabled={disabled}
            className="rounded-full bg-brand-800 px-3.5 py-2 text-xs font-semibold text-brand-100 ring-1 ring-brand-400/40 transition hover:bg-brand-700 hover:text-white disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModelPicker({
  value,
  onChange,
}: {
  value: ChatModelChoice;
  onChange: (next: ChatModelChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = CHAT_MODEL_CHOICES.find((c) => c.slug === value) ?? CHAT_MODEL_CHOICES[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="btn-ghost inline-flex items-center gap-1.5 rounded-full border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-bold"
      >
        <Sparkles className="h-3.5 w-3.5 text-brand-200" />
        <span className="max-w-[9rem] truncate">{current.label}</span>
        <ChevronDown
          className={
            "h-3.5 w-3.5 text-brand-100 transition-transform duration-300 " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="rise-in absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-brand-400/40 bg-brand-600 py-1 shadow-float"
        >
          {CHAT_MODEL_CHOICES.map((choice) => (
            <button
              key={choice.slug}
              type="button"
              role="option"
              aria-selected={choice.slug === value}
              onClick={() => {
                onChange(choice.slug);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-brand-800"
            >
              <Check
                className={
                  "h-4 w-4 shrink-0 text-brand-200 " + (choice.slug === value ? "" : "opacity-0")
                }
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{choice.label}</span>
                <span className="block truncate text-[11px] text-brand-100">{choice.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onOpen,
  onDelete,
  onRename,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onOpen: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (conversations.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-brand-200">
        Your chats will appear here once you send a message.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {conversations.map((conversation) => {
        const active = conversation.id === activeId;
        if (editingId === conversation.id) {
          return (
            <li key={conversation.id} className="px-1 py-1">
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => {
                  if (editValue.trim()) onRename(conversation.id, editValue);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full rounded-lg border border-brand-400/50 bg-brand-800 px-2.5 py-2 text-sm text-white focus:border-brand-200 focus:outline-none"
              />
            </li>
          );
        }
        return (
          <li key={conversation.id} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(conversation)}
              className={
                "flex w-full items-center rounded-lg py-2 pl-3 pr-16 text-left text-sm font-medium transition-colors " +
                (active
                  ? "bg-brand-400 text-white"
                  : "text-brand-100 hover:bg-brand-800 hover:text-white")
              }
            >
              <span className="truncate">{conversation.title}</span>
            </button>
            {/* Always reachable on touch, where there is no hover to reveal them. */}
            <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              <button
                type="button"
                onClick={() => {
                  setEditingId(conversation.id);
                  setEditValue(conversation.title);
                }}
                aria-label={`Rename ${conversation.title}`}
                className="grid h-7 w-7 place-items-center rounded-md text-brand-100 hover:bg-brand-700 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(conversation.id)}
                aria-label={`Delete ${conversation.title}`}
                className="grid h-7 w-7 place-items-center rounded-md text-brand-100 hover:bg-brand-700 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
