import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Layers } from "lucide-react";
import { RevealLink } from "@/components/ui/reveal-card";
import { Panel } from "@/components/ui/panel";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { AnkiDeckCounts } from "@/components/vocab/AnkiDeckCounts";
import type { DeckPickerRow } from "@/lib/vocab/client";

function DeckRow({ row }: { row: DeckPickerRow }) {
  return (
    <RevealLink to="/vocab/deck/$deckId" params={{ deckId: row.id }} className="block">
      <Panel className="group p-4 transition hover:border-brand-400/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-400/20 text-brand-100 ring-1 ring-brand-300/25">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-bold text-white">{row.title}</h3>
              <p className="text-xs text-brand-100">
                {row.cardCount} card{row.cardCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <AnkiDeckCounts
            newCount={row.newCount}
            learningCount={row.learningCount}
            reviewCount={row.reviewCount}
          />
        </div>
      </Panel>
    </RevealLink>
  );
}

function FolderRow({
  row,
  depth,
  isOpen,
  childCount,
  onToggle,
}: {
  row: DeckPickerRow;
  depth: number;
  isOpen: boolean;
  childCount: number;
  onToggle: () => void;
}) {
  const ref = usePointerGlow<HTMLButtonElement>();

  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      style={{ marginLeft: depth * 12 }}
      className="reveal-surface tap flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-400/40 bg-brand-600 px-4 py-3 text-left text-white shadow-panel transition hover:border-brand-400/60"
    >
      <span className="flex min-w-0 items-center gap-2.5 font-bold">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-400/25 text-brand-100 ring-1 ring-brand-300/30">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <FolderOpen className="h-4 w-4 shrink-0 text-brand-200" aria-hidden />
        <span className="truncate">{row.title}</span>
        <span className="text-xs font-semibold text-brand-100">({childCount})</span>
      </span>
      <AnkiDeckCounts
        newCount={row.newCount}
        learningCount={row.learningCount}
        reviewCount={row.reviewCount}
      />
    </button>
  );
}

export function DeckTreeList({ rows }: { rows: DeckPickerRow[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { roots, byParent } = useMemo(() => {
    const byParent = new Map<string | null, DeckPickerRow[]>();
    for (const row of rows) {
      const key = row.parent_id;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(row);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    }
    const roots = byParent.get(null) ?? [];
    return { roots, byParent };
  }, [rows]);

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  }

  function renderNode(row: DeckPickerRow, depth = 0): React.ReactNode {
    if (row.is_folder) {
      const children = byParent.get(row.id) ?? [];
      const isOpen = open[row.id] ?? false;
      return (
        <div key={row.id} className="space-y-2">
          <FolderRow
            row={row}
            depth={depth}
            isOpen={isOpen}
            childCount={children.length}
            onToggle={() => toggle(row.id)}
          />
          {isOpen ? (
            <div className="space-y-2">{children.map((child) => renderNode(child, depth + 1))}</div>
          ) : null}
        </div>
      );
    }

    return (
      <div key={row.id} style={{ marginLeft: depth * 12 }}>
        <DeckRow row={row} />
      </div>
    );
  }

  const leafOnly = rows.filter((r) => !r.is_folder);
  if (roots.length === 0) {
    return (
      <div className="space-y-3">
        {leafOnly.map((row) => (
          <DeckRow key={row.id} row={row} />
        ))}
      </div>
    );
  }

  return <div className="space-y-3">{roots.map((row) => renderNode(row))}</div>;
}
