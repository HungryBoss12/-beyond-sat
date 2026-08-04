import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, RotateCcw, Sparkles, Square } from "lucide-react";
import { MathText } from "@/components/MathText";
import { Panel, PanelHead } from "@/components/ui/panel";
import { useBeyondAi, type AiTask } from "@/lib/ai/client";

/**
 * The Beyond AI chat surface (master_plan.md §3C).
 *
 * Assistant turns render through <MathText>, which already handles `$…$`,
 * `$$…$$`, `\(…\)` and `\[…\]` — the reason the system prompt insists on LaTeX
 * delimiters. Nothing here parses maths itself.
 */

export function AiChatPanel({
  task = "reasoning",
  title = "Ask Beyond AI",
  hint,
  quickActions = [],
  contextPrefix,
  className,
}: {
  task?: AiTask;
  title?: string;
  hint?: string;
  /** Chips that seed the input. */
  quickActions?: string[];
  /**
   * Prepended to the first message only — the student's own stats, so the model
   * can answer "what should I work on" without a tool call. Sent as part of the
   * user turn rather than the system prompt, because the system prompt is built
   * server-side and must not be client-controlled.
   */
  contextPrefix?: string;
  className?: string;
}) {
  const { messages, streaming, error, send, stop, reset } = useBeyondAi(task);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentContext = useRef(false);

  /* Pin to the bottom as tokens arrive, but only when the student is already
     near the bottom — yanking the view back while they're re-reading an earlier
     step is worse than letting new text land off-screen. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const withContext =
      contextPrefix && !sentContext.current ? `${contextPrefix}\n\n${trimmed}` : trimmed;
    sentContext.current = true;
    setDraft("");
    void send(withContext);
  }

  const empty = messages.length === 0;

  return (
    <Panel className={className}>
      <PanelHead
        label={title}
        icon={Sparkles}
        hint={hint ?? "Your personal Digital SAT coach"}
        action={
          messages.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                sentContext.current = false;
                reset();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-2.5 py-1.5 text-[11px] font-bold text-brand-100 ring-1 ring-brand-400/40 transition hover:text-white"
            >
              <RotateCcw className="h-3 w-3" /> New chat
            </button>
          ) : undefined
        }
      />

      <div
        ref={scrollRef}
        className="mt-4 max-h-[26rem] min-h-[9rem] space-y-3 overflow-y-auto pr-1"
        aria-live="polite"
        aria-atomic="false"
      >
        {empty ? (
          <div className="rounded-xl border border-dashed border-brand-300/50 bg-brand-800/50 p-4">
            <p className="text-sm text-brand-100">
              Ask about a question you missed, a concept that isn't sticking, or what to study
              next. Answers come back with full working, and maths is properly typeset.
            </p>
          </div>
        ) : (
          messages.map((m, i) => <Turn key={i} role={m.role} content={m.content} />)
        )}

        {error && (
          <p className="rounded-xl bg-brand-800 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-brand-400/50">
            {error}
          </p>
        )}
      </div>

      {quickActions.length > 0 && empty && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quickActions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              disabled={streaming}
              className="rounded-full bg-brand-800 px-3 py-1.5 text-xs font-semibold text-brand-100 ring-1 ring-brand-400/40 transition hover:bg-brand-700 hover:text-white disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <label className="sr-only" htmlFor="beyond-ai-input">
          Message Beyond AI
        </label>
        <textarea
          id="beyond-ai-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Enter sends, Shift+Enter breaks the line — chat convention, and the
          // textarea exists for multi-line question text.
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          rows={2}
          placeholder="Explain why I got this wrong…"
          className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
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
            disabled={!draft.trim()}
            aria-label="Send"
            className="btn-brand grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-400 text-white disabled:opacity-50"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </form>
    </Panel>
  );
}

function Turn({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-400 px-3.5 py-2.5 text-sm font-medium text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-brand-800 px-3.5 py-2.5 text-sm leading-relaxed text-white ring-1 ring-brand-400/30">
        {content ? (
          /* `ai-prose` styles the KaTeX output and the plain-text structure the
             model returns; MathText only handles the maths itself. */
          <MathText block className="ai-prose" >
            {content}
          </MathText>
        ) : (
          <span className="inline-flex items-center gap-2 text-brand-100">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </span>
        )}
      </div>
    </div>
  );
}
