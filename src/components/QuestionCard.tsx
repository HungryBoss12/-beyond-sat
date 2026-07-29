import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Highlighter, StickyNote, Trash2, X as XIcon } from "lucide-react";
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
  total,
  answer,
  onChange,
  reveal,
  correctChoiceId,
}: {
  q: QuestionRow;
  index: number;
  total: number;
  answer: AnswerState;
  onChange: (a: AnswerState) => void;
  reveal?: boolean;
  correctChoiceId?: string | null;
}) {
  const choices = useMemo(() => (Array.isArray(q.choices) ? q.choices : []), [q.choices]);
  const hasPassage = !!q.prompt;

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
    const note = withNote ? window.prompt("Add a note for this highlight:", "") ?? "" : "";
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
      const note = withNote ? window.prompt("Add a note for this highlight:", "") ?? "" : "";
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
    let text = q.prompt;
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
      if (r.start > cursor) parts.push(<MathText key={`t-${i}`}>{text.slice(cursor, r.start)}</MathText>);
      parts.push(
        <mark
          key={`h-${i}`}
          title={r.note || "Highlighted"}
          className="bg-yellow-200/80 rounded px-0.5"
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
    <div className="rounded-2xl border-2 border-blue-600/40 bg-white soft-shadow overflow-hidden ring-1 ring-primary/10">
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-blue-600/20 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-slate-600 tabular-nums">
            Question {index + 1} of {total}
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {q.section === "math" ? "Math" : "R&W"} · {q.skill}
          </span>
        </div>
        <button
          onClick={() => onChange({ ...answer, markedForReview: !answer.markedForReview })}
          className={
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition " +
            (answer.markedForReview
              ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200")
          }
        >
          {answer.markedForReview ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          Mark for review
        </button>
      </div>

      {hasPassage ? (
        <div ref={containerRef} className="flex flex-col md:flex-row min-h-[680px]">
          {/* Passage */}
          <div
            className="relative border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto"
            style={{ flexBasis: `${leftPct}%` }}
          >
            <div
              ref={passageRef}
              onMouseUp={handlePassageMouseUp}
              onContextMenu={handlePassageContextMenu}
              className="p-8 md:p-10 text-[18px] md:text-[19px] leading-8 text-slate-900 whitespace-pre-wrap selection:bg-primary/20"
            >
              {renderedPassage}
              {q.image_url ? (
                <img
                  src={q.image_url}
                  alt=""
                  className="mt-5 max-w-full rounded-lg border border-slate-200"
                />
              ) : null}
            </div>

            {toolbar && (
              <div
                className="absolute z-10 -translate-x-1/2 -translate-y-full flex items-center gap-1 rounded-lg border border-slate-200 bg-white shadow-lg px-1.5 py-1"
                style={{ left: toolbar.x, top: toolbar.y }}
              >
                <button
                  onClick={() => addHighlight(false)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-yellow-50"
                >
                  <Highlighter className="h-3.5 w-3.5 text-yellow-600" /> Highlight
                  <kbd
                    title="Change in Profile → Highlight shortcuts"
                    className="ml-1 rounded px-1 text-[10px] font-mono bg-slate-100 text-slate-500"
                  >{formatBinding(bindings.highlight)}</kbd>
                </button>
                <button
                  onClick={() => addHighlight(true)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <StickyNote className="h-3.5 w-3.5 text-blue-600" /> Note
                  <kbd
                    title="Change in Profile → Highlight shortcuts"
                    className="ml-1 rounded px-1 text-[10px] font-mono bg-slate-100 text-slate-500"
                  >{formatBinding(bindings.note)}</kbd>
                </button>
              </div>
            )}

            {answer.highlights.length > 0 && (
              <div className="border-t border-slate-200 bg-yellow-50/40 p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Highlights & notes
                </div>
                {answer.highlights.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start gap-2 rounded-md bg-white border border-yellow-200 p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 line-clamp-2">
                        <mark className="bg-yellow-200/80 rounded px-0.5"><MathText>{h.text}</MathText></mark>
                      </div>
                      {h.note && (
                        <div className="mt-1 text-xs text-slate-600 italic">“{h.note}”</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeHighlight(h.id)}
                      className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={() => {
              draggingRef.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
            className="hidden md:flex w-1.5 items-center justify-center cursor-col-resize bg-slate-100 hover:bg-primary/30 transition"
            title="Drag to resize"
          >
            <div className="h-10 w-1 rounded-full bg-slate-300" />
          </div>

          {/* Question */}
          <div className="flex-1 overflow-y-auto" style={{ flexBasis: `${100 - leftPct}%` }}>
            <QuestionBody
              q={q}
              choices={choices}
              answer={answer}
              onChange={onChange}
              reveal={reveal}
              correctChoiceId={correctChoiceId}
            />
          </div>
        </div>
      ) : (
        <div className="p-8 md:p-10">
          <QuestionBody
            q={q}
            choices={choices}
            answer={answer}
            onChange={onChange}
            reveal={reveal}
            correctChoiceId={correctChoiceId}
          />
        </div>
      )}
    </div>
  );
}

function QuestionBody({
  q,
  choices,
  answer,
  onChange,
  reveal,
  correctChoiceId,
}: {
  q: QuestionRow;
  choices: Choice[];
  answer: AnswerState;
  onChange: (a: AnswerState) => void;
  reveal?: boolean;
  correctChoiceId?: string | null;
}) {
  function toggleEliminate(id: string) {
    const has = answer.eliminated.includes(id);
    onChange({
      ...answer,
      eliminated: has ? answer.eliminated.filter((x) => x !== id) : [...answer.eliminated, id],
      selectedChoiceId:
        !has && answer.selectedChoiceId === id ? null : answer.selectedChoiceId,
    });
  }

  return (
    <div className="p-8 md:p-10">
      <MathText block className="text-[18px] md:text-[19px] font-semibold text-slate-900 leading-8 whitespace-pre-wrap">
        {q.question_text}
      </MathText>

      {q.kind === "grid_in" ? (
        <div className="mt-6">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Your answer
          </label>
          <input
            value={answer.gridAnswer}
            onChange={(e) => onChange({ ...answer, gridAnswer: e.target.value })}
            inputMode="numeric"
            className="mt-2 block w-full max-w-xs rounded-lg border border-slate-200 px-4 py-3 text-xl font-bold tabular-nums focus:border-blue-600 focus:outline-none"
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
              <li key={c.id}>
                <div
                  className={
                    "flex items-start gap-4 rounded-xl border-2 p-4 md:p-5 transition " +
                    (isCorrect
                      ? "border-emerald-300 bg-emerald-50"
                      : isWrong
                      ? "border-red-300 bg-red-50"
                      : selected
                      ? "border-blue-600 bg-blue-50"
                      : eliminated
                      ? "border-slate-200 bg-slate-50 opacity-60"
                      : "border-slate-200 bg-white hover:border-blue-600/40")
                  }
                >
                  <button
                    disabled={reveal}
                    onClick={() =>
                      onChange({
                        ...answer,
                        selectedChoiceId: c.id,
                        eliminated: answer.eliminated.filter((x) => x !== c.id),
                      })
                    }
                    className={
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-base font-black transition " +
                      (selected
                        ? "border-blue-600 bg-primary text-white"
                        : "border-slate-300 text-slate-600 hover:border-blue-600")
                    }
                  >
                    {LETTERS[i]}
                  </button>
                  <button
                    disabled={reveal}
                    onClick={() =>
                      onChange({
                        ...answer,
                        selectedChoiceId: c.id,
                        eliminated: answer.eliminated.filter((x) => x !== c.id),
                      })
                    }
                    className={
                      "flex-1 text-left text-[18px] md:text-[19px] leading-8 pt-1.5 " +
                      (eliminated ? "line-through text-slate-400" : "text-slate-800")
                    }
                  >
                    <MathText>{c.text}</MathText>
                  </button>
                  {!reveal && (
                    <button
                      onClick={() => toggleEliminate(c.id)}
                      title="Cross out"
                      className={
                        "shrink-0 rounded-md p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition " +
                        (eliminated ? "text-slate-700 bg-slate-100" : "")
                      }
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
