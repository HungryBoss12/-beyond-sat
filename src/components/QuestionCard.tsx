import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Highlighter,
  StickyNote,
  Trash2,
  X as XIcon,
} from "lucide-react";
import { MathText } from "@/components/MathText";
import {
  DEFAULT_HIGHLIGHT_BINDINGS,
  formatBinding,
  loadHighlightBindings,
  matchesBinding,
  subscribeHighlightBindings,
  type HighlightBindings,
} from "@/lib/highlightBindings";

export type Choice = { id: string; text: string };

export type QuestionRow = {
  id: string;
  section: "reading_writing" | "math";
  skill: string;
  difficulty: "easy" | "medium" | "hard";
  kind: "multiple_choice" | "grid_in";
  prompt: string | null;
  question_text: string;
  choices: Choice[] | null;
  image_url: string | null;
};

export type Highlight = { id: string; text: string; note: string };

export type AnswerState = {
  selectedChoiceId: string | null;
  gridAnswer: string;
  eliminated: string[];
  markedForReview: boolean;
  highlights: Highlight[];
};

export function emptyAnswer(): AnswerState {
  return {
    selectedChoiceId: null,
    gridAnswer: "",
    eliminated: [],
    markedForReview: false,
    highlights: [],
  };
}

export function isAnswered(a: AnswerState, kind: QuestionRow["kind"]) {
  return kind === "grid_in" ? a.gridAnswer.trim().length > 0 : !!a.selectedChoiceId;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionCard({
  q,
  index,
  answer,
  onChange,
  reveal,
  correctChoiceId,
  showNotes,
  onCloseNotes,
}: {
  q: QuestionRow;
  index: number;
  answer: AnswerState;
  onChange: (a: AnswerState) => void;
  reveal?: boolean;
  correctChoiceId?: string | null;
  /* Bluebook keeps highlights and notes behind a header control rather than
     listing them under the passage, and that control lives in the chrome — so
     the open state is owned by the caller and passed down. Omitting it (the
     review screen does) simply never opens the panel. */
  showNotes?: boolean;
  onCloseNotes?: () => void;
}) {
  const choices = useMemo(() => (Array.isArray(q.choices) ? q.choices : []), [q.choices]);
  const hasPassage = !!(q.prompt || q.image_url);

  /* Bluebook hides the cross-out controls until the student turns them on, and
     the setting then persists for the rest of the sitting. This component
     instance is reused as `index` changes — TestPlayer renders it without a
     key — so plain state is already per-sitting rather than per-question. */
  const [crossOut, setCrossOut] = useState(false);

  // Resizable split
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(50);
  const draggingRef = useRef(false);

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftPct(Math.min(80, Math.max(20, pct)));
  }, []);
  const onDragEnd = useCallback(() => {
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);
  useEffect(() => {
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  // Selection toolbar for highlighting
  const passageRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<{ x: number; y: number; text: string } | null>(null);

  function computeSelectionToolbar(): { x: number; y: number; text: string } | null {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !passageRef.current) return null;
    const text = sel.toString().trim();
    if (!text) return null;
    const anchor = sel.anchorNode as Node | null;
    if (!anchor || !passageRef.current.contains(anchor)) return null;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const parent = passageRef.current.getBoundingClientRect();
    return {
      x: rect.left - parent.left + rect.width / 2,
      y: rect.top - parent.top - 8,
      text,
    };
  }

  function handlePassageMouseUp() {
    setToolbar(computeSelectionToolbar());
  }

  function handlePassageContextMenu(e: React.MouseEvent) {
    const tb = computeSelectionToolbar();
    if (!tb) return;
    e.preventDefault();
    setToolbar(tb);
  }

  function addHighlight(withNote: boolean) {
    if (!toolbar) return;
    const note = withNote ? (window.prompt("Add a note for this highlight:", "") ?? "") : "";
    const h: Highlight = {
      id: crypto.randomUUID(),
      text: toolbar.text,
      note,
    };
    onChange({ ...answer, highlights: [...answer.highlights, h] });
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }

  function removeHighlight(id: string) {
    onChange({ ...answer, highlights: answer.highlights.filter((h) => h.id !== id) });
  }

  // Keyboard shortcuts — edited from the Profile page, shared via localStorage.
  const [bindings, setBindings] = useState<HighlightBindings>(DEFAULT_HIGHLIGHT_BINDINGS);
  useEffect(() => {
    setBindings(loadHighlightBindings());
    const off = subscribeHighlightBindings(setBindings);
    return off;
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      const isHighlight = matchesBinding(e, bindings.highlight);
      const isNote = matchesBinding(e, bindings.note);
      if (!isHighlight && !isNote) return;
      const tb = computeSelectionToolbar();
      if (!tb) return;
      e.preventDefault();
      const withNote = isNote;
      const note = withNote ? (window.prompt("Add a note for this highlight:", "") ?? "") : "";
      const h: Highlight = { id: crypto.randomUUID(), text: tb.text, note };
      onChange({ ...answer, highlights: [...answer.highlights, h] });
      setToolbar(null);
      window.getSelection()?.removeAllRanges();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, onChange, bindings]);

  // Render passage with highlight underlines
  const renderedPassage = useMemo(() => {
    if (!q.prompt) return null;
    const text = q.prompt;
    // For visual highlight, wrap each highlight substring (first occurrence)
    // Build a list of ranges
    type R = { start: number; end: number; hid: string; note: string };
    const ranges: R[] = [];
    for (const h of answer.highlights) {
      const i = text.indexOf(h.text);
      if (i >= 0) ranges.push({ start: i, end: i + h.text.length, hid: h.id, note: h.note });
    }
    ranges.sort((a, b) => a.start - b.start);
    // dedupe overlapping
    const clean: R[] = [];
    for (const r of ranges) {
      if (clean.length === 0 || r.start >= clean[clean.length - 1].end) clean.push(r);
    }
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    clean.forEach((r, i) => {
      if (r.start > cursor)
        parts.push(<MathText key={`t-${i}`}>{text.slice(cursor, r.start)}</MathText>);
      parts.push(
        <mark
          key={`h-${i}`}
          title={r.note || "Highlighted"}
          // On the light surface a highlight can behave like a real highlight
          // again: a soft blue wash under navy text.
          className="rounded bg-test-tint px-0.5 text-test-ink ring-1 ring-test-edge"
        >
          <MathText>{text.slice(r.start, r.end)}</MathText>
        </mark>,
      );
      cursor = r.end;
    });
    if (cursor < text.length) parts.push(<MathText key="t-end">{text.slice(cursor)}</MathText>);
    return parts;
  }, [q.prompt, answer.highlights]);

  return (
    /* Full bleed, no card. Bluebook has no panel and no page margin: the
       passage runs to the left edge of the window and the question to the
       right, with a single hairline between them. `min-h-0` on every level of
       this column is what lets the two panes scroll independently instead of
       stretching the runner and pushing the footer off-screen. */
    <div className="relative flex min-h-0 flex-1 flex-col bg-test-canvas">
      {hasPassage ? (
        <div ref={containerRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Passage */}
          <div
            className="relative min-h-0 flex-1 overflow-y-auto border-b border-test-line md:flex-none md:border-b-0 md:border-r"
            style={{ flexBasis: `${leftPct}%` }}
          >
            <div
              ref={passageRef}
              onMouseUp={handlePassageMouseUp}
              onContextMenu={handlePassageContextMenu}
              className="whitespace-pre-wrap px-6 py-6 text-[18px] leading-[1.7] text-test-ink selection:bg-test-tint md:px-10 md:py-8 md:text-[19px]"
            >
              {renderedPassage}
              {q.image_url ? (
                <img
                  src={q.image_url}
                  alt=""
                  className="mt-5 max-w-full rounded border border-test-line"
                />
              ) : null}
            </div>

            {toolbar && (
              <div
                className="pop-in absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg border border-test-line bg-white px-1.5 py-1 shadow-float"
                style={{ left: toolbar.x, top: toolbar.y }}
              >
                <button
                  onClick={() => addHighlight(false)}
                  className="tap inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-test-ink hover:bg-test-tint"
                >
                  <Highlighter className="h-3.5 w-3.5 text-test-accent" /> Highlight
                  <kbd
                    title="Change in Profile → Highlight shortcuts"
                    className="ml-1 rounded bg-test-well px-1 font-mono text-[10px] text-test-muted"
                  >
                    {formatBinding(bindings.highlight)}
                  </kbd>
                </button>
                <button
                  onClick={() => addHighlight(true)}
                  className="tap inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-test-ink hover:bg-test-tint"
                >
                  <StickyNote className="h-3.5 w-3.5 text-test-accent" /> Note
                  <kbd
                    title="Change in Profile → Highlight shortcuts"
                    className="ml-1 rounded bg-test-well px-1 font-mono text-[10px] text-test-muted"
                  >
                    {formatBinding(bindings.note)}
                  </kbd>
                </button>
              </div>
            )}
          </div>

          {/* Drag handle — Bluebook's is a thin rail with a grip, sitting on the
              divider itself rather than taking a column of its own. */}
          <div
            onMouseDown={() => {
              draggingRef.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
            className="hidden w-1.5 cursor-col-resize items-center justify-center bg-test-chrome transition hover:bg-test-tint md:flex"
            title="Drag to resize"
          >
            <div className="h-10 w-1 rounded-full bg-test-edge" />
          </div>

          {/* Question */}
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            style={{ flexBasis: `${100 - leftPct}%` }}
          >
            <QuestionBody
              q={q}
              index={index}
              choices={choices}
              answer={answer}
              onChange={onChange}
              reveal={reveal}
              correctChoiceId={correctChoiceId}
              crossOut={crossOut}
              onToggleCrossOut={() => setCrossOut((v) => !v)}
            />
          </div>
        </div>
      ) : (
        /* No passage — Bluebook centres the question in the window instead of
           stretching a one-line equation across the full width. */
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl">
            <QuestionBody
              q={q}
              index={index}
              choices={choices}
              answer={answer}
              onChange={onChange}
              reveal={reveal}
              correctChoiceId={correctChoiceId}
              crossOut={crossOut}
              onToggleCrossOut={() => setCrossOut((v) => !v)}
            />
          </div>
        </div>
      )}

      {/* Highlights & notes — a floating panel, opened from the header, rather
          than a list appended under the passage. Rendered at this level so it
          also reaches a question that has no passage pane to sit in. */}
      {showNotes && (
        <div className="pop-in absolute right-4 top-4 z-30 w-[min(92vw,22rem)] overflow-hidden rounded-lg border border-test-line bg-white shadow-float">
          <div className="flex items-center justify-between border-b border-test-line bg-test-chrome px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-test-muted">
              Highlights &amp; notes
            </span>
            <button
              onClick={onCloseNotes}
              className="tap rounded p-1 text-test-muted hover:bg-test-well hover:text-test-ink"
              aria-label="Close highlights and notes"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto p-3">
            {answer.highlights.length === 0 ? (
              <p className="px-1 py-2 text-xs text-test-muted">
                Select text in the passage, then choose Highlight or Note.
              </p>
            ) : (
              answer.highlights.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start gap-2 rounded border border-test-line bg-white p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm text-test-ink">
                      {/* Same treatment as in the passage. */}
                      <mark className="rounded bg-test-tint px-0.5 text-test-ink ring-1 ring-test-edge">
                        <MathText>{h.text}</MathText>
                      </mark>
                    </div>
                    {h.note && (
                      <div className="mt-1 text-xs italic text-test-muted">“{h.note}”</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeHighlight(h.id)}
                    className="tap rounded p-1 text-test-muted hover:bg-test-well hover:text-test-accent"
                    aria-label="Remove highlight"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The Bluebook cross-out glyph: a capital A inside a circle with a rule struck
 * through it. lucide has no equivalent, and it's the control students actually
 * look for, so it's drawn here rather than approximated with an X.
 */
function CrossOutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.6 15.4 12 7.8l3.4 7.6M9.7 13.2h4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 19.5 19.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function QuestionBody({
  q,
  index,
  choices,
  answer,
  onChange,
  reveal,
  correctChoiceId,
  crossOut,
  onToggleCrossOut,
}: {
  q: QuestionRow;
  index: number;
  choices: Choice[];
  answer: AnswerState;
  onChange: (a: AnswerState) => void;
  reveal?: boolean;
  correctChoiceId?: string | null;
  crossOut: boolean;
  onToggleCrossOut: () => void;
}) {
  function toggleEliminate(id: string) {
    const has = answer.eliminated.includes(id);
    onChange({
      ...answer,
      eliminated: has ? answer.eliminated.filter((x) => x !== id) : [...answer.eliminated, id],
      selectedChoiceId: !has && answer.selectedChoiceId === id ? null : answer.selectedChoiceId,
    });
  }

  function select(id: string) {
    onChange({
      ...answer,
      selectedChoiceId: id,
      eliminated: answer.eliminated.filter((x) => x !== id),
    });
  }

  return (
    <div className="px-6 pb-10 pt-6 md:px-10 md:pt-8">
      {/* Bluebook's question header: the number in a dark square, the review
          bookmark beside it, and the cross-out toggle pushed to the far right.
          This lives in the question pane, not in the page chrome, because it
          belongs to the question — moving it up to the top bar is the single
          biggest thing that makes a clone read as "not Bluebook". */}
      <div className="flex items-center gap-3 pb-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-test-dark text-sm font-bold tabular-nums text-white">
          {index + 1}
        </span>
        <button
          onClick={() => onChange({ ...answer, markedForReview: !answer.markedForReview })}
          className="tap inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm font-semibold text-test-ink hover:bg-test-well"
          aria-pressed={answer.markedForReview}
        >
          {answer.markedForReview ? (
            <BookmarkCheck className="h-4 w-4 text-test-accent" />
          ) : (
            <Bookmark className="h-4 w-4 text-test-muted" />
          )}
          Mark for Review
        </button>
        <span className="ml-auto hidden truncate text-xs font-semibold uppercase tracking-wider text-test-muted lg:inline">
          {q.skill}
        </span>
        {!reveal && q.kind !== "grid_in" && (
          <button
            onClick={onToggleCrossOut}
            title="Cross out answer choices"
            aria-pressed={crossOut}
            className={
              "tap ml-auto grid h-8 w-8 shrink-0 place-items-center rounded lg:ml-3 " +
              (crossOut ? "bg-test-accent text-white" : "text-test-accent hover:bg-test-well")
            }
          >
            <CrossOutIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="border-t border-test-line" />

      <MathText
        block
        className="whitespace-pre-wrap pt-5 text-[18px] font-medium leading-[1.7] text-test-ink md:text-[19px]"
      >
        {q.question_text}
      </MathText>

      {q.kind === "grid_in" ? (
        <div className="mt-6">
          <label className="text-xs font-bold uppercase tracking-wider text-test-muted">
            Your answer
          </label>
          <input
            value={answer.gridAnswer}
            onChange={(e) => onChange({ ...answer, gridAnswer: e.target.value })}
            inputMode="numeric"
            className="mt-2 block w-full max-w-xs rounded border-2 border-test-edge bg-white px-4 py-3 text-xl font-bold tabular-nums text-test-ink placeholder:text-test-muted/60 focus:border-test-accent focus:outline-none"
            placeholder="e.g. 3.14 or 5/8"
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {choices.map((c, i) => {
            const eliminated = answer.eliminated.includes(c.id);
            const selected = answer.selectedChoiceId === c.id;
            const isCorrect = reveal && correctChoiceId === c.id;
            const isWrong = reveal && selected && correctChoiceId !== c.id;
            return (
              <li key={i} className="flex items-stretch gap-2">
                {/* The option itself. Bluebook fills only the letter circle on
                    selection and leaves the option white with a 2px blue rule —
                    a fully filled row would invert the text and cost contrast on
                    the thing the student is actually reading. Review mode keeps
                    hue out of correct/wrong; the ✓/✗ on the circle carries it. */}
                <button
                  disabled={reveal}
                  onClick={() => select(c.id)}
                  className={
                    "flex flex-1 items-start gap-3 rounded-lg border-2 bg-white px-4 py-3 text-left transition disabled:cursor-default " +
                    (isCorrect
                      ? "border-test-accent"
                      : isWrong
                        ? "border-test-muted"
                        : selected
                          ? "border-test-accent"
                          : eliminated
                            ? "border-test-line"
                            : "border-test-edge hover:border-test-accent hover:bg-test-tint")
                  }
                >
                  <span
                    className={
                      "mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border text-sm font-bold " +
                      (isCorrect
                        ? "border-test-accent bg-test-accent text-white"
                        : isWrong
                          ? "border-test-muted bg-test-muted text-white"
                          : selected
                            ? "border-test-accent bg-test-accent text-white"
                            : "border-test-ink text-test-ink")
                    }
                  >
                    {isCorrect ? (
                      <Check className="h-4 w-4" />
                    ) : isWrong ? (
                      <XIcon className="h-4 w-4" />
                    ) : (
                      LETTERS[i]
                    )}
                  </span>
                  <span
                    className={
                      "flex-1 text-[17px] leading-[1.6] md:text-[18px] " +
                      (eliminated ? "text-test-muted line-through" : "text-test-ink")
                    }
                  >
                    <MathText>{c.text}</MathText>
                  </span>
                </button>

                {/* Outside the option, exactly where Bluebook puts it — a
                    cross-out is a note to yourself about the choice, not a way
                    of answering, so it must not be reachable by a stray click
                    inside the option. Hidden until the toggle is on. */}
                {!reveal && crossOut && (
                  <button
                    onClick={() => toggleEliminate(c.id)}
                    title={eliminated ? "Undo cross-out" : `Cross out ${LETTERS[i]}`}
                    className="tap grid w-11 shrink-0 place-items-center rounded text-test-accent hover:bg-test-well"
                  >
                    {eliminated ? (
                      <span className="text-xs font-bold underline">Undo</span>
                    ) : (
                      <span className="relative grid h-[26px] w-[26px] place-items-center rounded-full border border-current text-sm font-bold">
                        {LETTERS[i]}
                        <span className="absolute left-0 right-0 top-1/2 h-px bg-current" />
                      </span>
                    )}
                  </button>
                )}
                {/* Reserves the gutter so turning the toggle on doesn't reflow
                    the option widths mid-question. */}
                {!reveal && !crossOut && <span aria-hidden="true" className="w-11 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
