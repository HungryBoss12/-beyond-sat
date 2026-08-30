import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { RevealLink } from "@/components/ui/reveal-card";
import { Panel } from "@/components/ui/panel";
import type { DeckPickerRow } from "@/lib/vocab/client";

function AnkiCounts({ row }: { row: DeckPickerRow }) {
  const { newCount, learningCount, reviewCount } = row;
  if (row.is_folder) {
    return (
      <div className="flex items-center gap-2 tabular-nums text-sm">
        <span className="text-sky-300">{newCount || 0}</span>
        <span className="text-brand-200/40">|</span>
        <span className="text-red-300">{learningCount || 0}</span>
        <span className="text-brand-200/40">|</span>
        <span className="text-emerald-300">{reviewCount || 0}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 tabular-nums text-sm font-bold">
      <span className="min-w-[1.25rem] text-right text-sky-300">{newCount || 0}</span>
      <span className="min-w-[1.25rem] text-right text-red-300">{learningCount || 0}</span>
      <span className="min-w-[1.25rem] text-right text-emerald-300">{reviewCount || 0}</span>
    </div>
  );
}

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
              <p className="text-xs text-white/50">
                {row.cardCount} card{row.cardCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <AnkiCounts row={row} />
        </div>
      </Panel>
    </RevealLink>
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
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function renderNode(row: DeckPickerRow, depth = 0): React.ReactNode {
    if (row.is_folder) {
      const children = byParent.get(row.id) ?? [];
      const isOpen = open[row.id] ?? true;
      return (
        <div key={row.id} className="space-y-2">
          <button
            type="button"
            onClick={() => toggle(row.id)}
            className="vocab-reveal-surface tap flex w-full items-center justify-between rounded-xl border border-white/20 bg-brand-800/60 px-4 py-3 text-left ring-1 ring-white/10"
            style={{ marginLeft: depth * 12 }}
          >
            <span className="flex items-center gap-2 font-bold text-white">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {row.title}
              <span className="text-xs font-normal text-white/50">({children.length})</span>
            </span>
            <AnkiCounts row={row} />
          </button>
          {isOpen ? (
            <div className="space-y-2">
              {children.map((child) => renderNode(child, depth + 1))}
            </div>
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
