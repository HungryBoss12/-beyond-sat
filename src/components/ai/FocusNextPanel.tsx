import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Loader2, RotateCcw, Sparkles, Square, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MathText } from "@/components/MathText";
import { ChatTurn } from "@/components/ai/ChatTurn";
import { Panel, PanelHead } from "@/components/ui/panel";
import { scrollNearBottom } from "@/lib/smooth-scroll";
import { askOnce, useBeyondAi } from "@/lib/ai/client";

/**
 * The dashboard's "Focus next" panel.
 *
 * This replaced two separate cards — a rule-based ranked list and a read-only AI
 * paragraph — that sat side by side saying overlapping things, with no way to
 * respond to either. Merging them makes the panel a conversation that opens with
 * a suggestion instead of a suggestion that dead-ends in a link to another page.
 *
 * Everything here runs on the `quick` task. The dashboard is the first screen a
 * student sees, and a reasoning model costs 10-30s before its first token, which
 * on a card this size reads as broken rather than thoughtful. Depth is what
 * /analysis is for; this is the glanceable surface.
 */

export type FocusRec = { title: string; desc: string; to: "/practice" };

export function FocusNextPanel({
  recs,
  weakestSkill,
  accuracy,
  latestScore,
  targetScore,
  className,
}: {
  /** Rule-based next actions. Always rendered — they don't depend on the model. */
  recs: FocusRec[];
  weakestSkill: string | null;
  accuracy: number | null;
  latestScore: number | null;
  targetScore: number | null;
  className?: string;
}) {
  const [suggestion, setSuggestion] = useState("");
  const [suggestState, setSuggestState] = useState<"idle" | "loading" | "error">("idle");
  const { messages, streaming, error, send, stop, reset } = useBeyondAi("quick");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /* The parent recomputes these props on every render of derived data, so a
     plain dependency array would re-fire the request. This gates on having asked
     at all — one opening suggestion per page visit is the intent. */
  const asked = useRef(false);
  const sentContext = useRef(false);

  /** The student's own numbers, in a form the model can read in one line. */
  const facts = useMemo(
    () =>
      [
        weakestSkill ? `weakest skill: ${weakestSkill}` : null,
        accuracy != null ? `overall accuracy: ${accuracy}%` : null,
        latestScore ? `latest mock score: ${latestScore}/1600` : null,
        targetScore ? `target score: ${targetScore}` : null,
      ]
        .filter(Boolean)
        .join(", "),
    [weakestSkill, accuracy, latestScore, targetScore],
  );

  useEffect(() => {
    // Wait for the stats to actually arrive; firing on the empty initial state
    // would spend a request describing a student with no data.
    if (asked.current || (!weakestSkill && accuracy == null)) return;
    asked.current = true;

    let cancelled = false;
    setSuggestState("loading");

    askOnce(
      `Here are my current stats — ${facts}. In no more than three sentences, tell me what to focus on today and roughly how many points it could be worth. Address me directly and don't restate my stats back to me.`,
      "quick",
    )
      .then((result) => {
        if (cancelled) return;
        setSuggestion(result.trim());
        setSuggestState("idle");
      })
      .catch(() => {
        if (!cancelled) setSuggestState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [facts, weakestSkill, accuracy]);

  /* Pin to the bottom as tokens arrive, but only when the student is already
     near the bottom — yanking the view back while they're re-reading an earlier
     answer is worse than letting new text land off-screen. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) scrollNearBottom(el, 120);
  }, [messages]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    /* The student's stats ride along with the first question only, so "what
       should I drill?" works without a tool call. Sent as part of the user turn
       rather than the system prompt, which is built server-side and must not be
       client-controlled. */
    const withContext =
      facts && !sentContext.current ? `My current stats — ${facts}.\n\n${trimmed}` : trimmed;
    sentContext.current = true;
    setDraft("");
    void send(withContext);
  }

  const chatting = messages.length > 0;

  /* Chips name the student's actual weak spot where there is one, so the first
     tap is already a question worth asking rather than a generic prompt. */
  const chips = [
    weakestSkill ? `How do I get better at ${weakestSkill}?` : "What should I work on first?",
    "Build me a study plan for this week",
    targetScore ? `What's between me and ${targetScore}?` : "How do I raise my score fastest?",
  ];

  return (
    <Panel className={className}>
      <PanelHead
        label="Focus next"
        icon={Zap}
        hint="Suggestions from Beyond AI, plus anything you want to ask"
        action={
          chatting ? (
            <button
              type="button"
              onClick={() => {
                sentContext.current = false;
                reset();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-2.5 py-1.5 text-[11px] font-bold text-brand-100 ring-1 ring-brand-400/40 transition hover:text-white"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          ) : undefined
        }
      />

      {/* Opening suggestion. Stays visible above the conversation rather than
          being replaced by it — it's the answer to the question the student
          didn't have to type. */}
      <div className="mt-3 rounded-xl bg-brand-800 px-3.5 py-3 text-sm leading-relaxed text-brand-100 ring-1 ring-brand-400/30">
        <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-200">
          <Sparkles className="h-3 w-3" /> Beyond AI recommends
        </span>
        {suggestState === "loading" && (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your results…
          </span>
        )}
        {suggestState === "error" && (
          <span>
            Beyond AI isn't available right now — the ranked steps below still apply, and your{" "}
            <Link to="/analysis" className="font-semibold text-white underline">
              analysis page
            </Link>{" "}
            has the full breakdown.
          </span>
        )}
        {suggestState === "idle" &&
          (suggestion ? (
            <MathText block className="ai-prose">
              {suggestion}
            </MathText>
          ) : (
            <span>
              Complete a practice set and Beyond AI will tell you exactly what to work on next.
            </span>
          ))}
      </div>

      {/* Rule-based steps. Always here, model or no model: they're derived from
          the student's own attempt data, so an outage never leaves this panel
          with nothing actionable in it. */}
      <div className="mt-3 space-y-2.5 stagger-fast">
        {recs.map((r, i) => (
          <Link
            key={i}
            to={r.to}
            className="group flex items-start gap-3 rounded-xl border border-brand-400/30 bg-brand-800 p-3 nudge hover:border-brand-300 hover:bg-brand-700"
          >
            <span className="tile-invert grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-brand-100">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">{r.title}</span>
              <span className="mt-0.5 block text-xs text-brand-100">{r.desc}</span>
            </span>
            <ArrowRight className="arrow-slide mt-1.5 h-4 w-4 shrink-0 text-brand-200 group-hover:text-white" />
          </Link>
        ))}
      </div>

      {chatting && (
        <div
          ref={scrollRef}
          className="mt-4 max-h-[22rem] space-y-3 overflow-y-auto border-t border-brand-400/30 pr-1 pt-4"
          aria-live="polite"
          aria-atomic="false"
        >
          {messages.map((m, i) => (
            /* The stats prefix is machinery, not something the student typed, so
               it's stripped from the transcript they read back. */
            <ChatTurn
              key={i}
              role={m.role}
              content={m.content}
              strip={/^My current stats — [^\n]*\n\n/}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-brand-800 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-brand-400/50">
          {error}
        </p>
      )}

      {!chatting && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              disabled={streaming}
              className="rounded-full bg-brand-800 px-3 py-1.5 text-left text-xs font-semibold text-brand-100 ring-1 ring-brand-400/40 transition hover:bg-brand-700 hover:text-white disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <label className="sr-only" htmlFor="focus-next-input">
          Ask Beyond AI
        </label>
        <textarea
          id="focus-next-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Enter sends, Shift+Enter breaks the line — chat convention, and the
          // textarea exists for pasted question text.
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          rows={1}
          placeholder="Ask Beyond AI anything…"
          className="min-h-[2.5rem] flex-1 resize-y rounded-xl border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop generating"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-800 text-white ring-1 ring-brand-400/50 transition hover:bg-brand-700"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="btn-brand grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-400 text-white disabled:opacity-50"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* This panel is the glanceable surface; the full section is where a
          conversation actually lives, with saved chats and image upload. */}
      <Link
        to="/beyond-ai"
        className="group mt-3 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-brand-100 hover:text-white"
      >
        {chatting ? "Continue in Beyond AI" : "Open Beyond AI"}
        <ArrowRight className="arrow-slide h-3.5 w-3.5" />
      </Link>
    </Panel>
  );
}
