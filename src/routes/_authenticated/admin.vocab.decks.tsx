import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderTree,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { PageHead, Panel } from "@/components/ui/panel";
import {
  deleteVocabDeck,
  fetchVocabDecks,
  patchVocabDeck,
} from "@/lib/vocab/client";
import type { VocabDeck } from "@/lib/vocab/types";

export const Route = createFileRoute("/_authenticated/admin/vocab/decks")({
  component: AdminVocabDecksPage,
  head: () => ({ meta: [{ title: "Manage decks — Admin" }] }),
});

function AdminDeckNode({
  deck,
  depth,
  childrenByParent,
  onRenamed,
  onDeleted,
}: {
  deck: VocabDeck;
  depth: number;
  childrenByParent: Map<string | null, VocabDeck[]>;
  onRenamed: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const children = childrenByParent.get(deck.id) ?? [];

  async function rename() {
    const next = prompt("Rename deck", deck.title);
    if (!next?.trim() || next.trim() === deck.title) return;
    setBusy(true);
    try {
      await patchVocabDeck(deck.id, next.trim());
      onRenamed();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const label = deck.is_folder ? "folder and subdecks" : "deck";
    if (!confirm(`Delete "${deck.title}" ${label}? Cards will be unassigned from this deck.`)) return;
    setBusy(true);
    try {
      await deleteVocabDeck(deck.id);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (deck.is_folder) {
    return (
      <div className="space-y-2" style={{ marginLeft: depth * 12 }}>
        <div className="flex items-center gap-2 rounded-xl border border-brand-400/30 bg-brand-800/80 px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="tap flex min-w-0 flex-1 items-center gap-2 text-left font-bold text-white"
          >
            {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <FolderTree className="h-4 w-4 shrink-0 text-brand-200" />
            <span className="truncate">{deck.title}</span>
            <span className="text-xs font-normal text-brand-200">({children.length})</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void rename()}
            className="tap rounded-lg p-2 text-brand-100 hover:bg-brand-700 hover:text-white disabled:opacity-40"
            title="Rename folder"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="tap rounded-lg p-2 text-brand-100 hover:bg-red-900/40 hover:text-red-200 disabled:opacity-40"
            title="Delete folder"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {open ? (
          <div className="space-y-2">
            {children.map((child) => (
              <AdminDeckNode
                key={child.id}
                deck={child}
                depth={depth + 1}
                childrenByParent={childrenByParent}
                onRenamed={onRenamed}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Panel className="flex items-center justify-between gap-3 p-3" style={{ marginLeft: depth * 12 }}>
      <div className="min-w-0">
        <div className="truncate font-bold text-white">{deck.title}</div>
        {deck.path ? <div className="truncate text-xs text-brand-200/70">{deck.path}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          to="/admin/vocab/deck/$deckId"
          params={{ deckId: deck.id }}
          className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/40 bg-brand-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Open
        </Link>
        <Link
          to="/vocab/deck/$deckId"
          params={{ deckId: deck.id }}
          className="tap rounded-lg p-2 text-brand-100 hover:bg-brand-700 hover:text-white"
          title="Preview study session"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void rename()}
          className="tap rounded-lg p-2 text-brand-100 hover:bg-brand-700 hover:text-white disabled:opacity-40"
          title="Rename deck"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="tap rounded-lg p-2 text-brand-100 hover:bg-red-900/40 hover:text-red-200 disabled:opacity-40"
          title="Delete deck"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Panel>
  );
}

function AdminVocabDecksPage() {
  const [decks, setDecks] = useState<VocabDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDecks(await fetchVocabDecks());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load decks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, VocabDeck[]>();
    for (const deck of decks) {
      const key = deck.parent_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(deck);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    }
    return map;
  }, [decks]);

  const roots = childrenByParent.get(null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <PageHead
        title="Manage decks"
        subtitle="Rename or delete imported Anki collections. Open a deck to edit individual words."
        action={
          <Link
            to="/admin/vocab"
            className="tap text-sm font-semibold text-brand-200 hover:text-white"
          >
            ← Back to import
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
        </div>
      ) : error ? (
        <Panel className="p-6 text-center text-brand-100">{error}</Panel>
      ) : roots.length === 0 ? (
        <Panel className="p-6 text-center text-brand-100">
          No decks yet.{" "}
          <Link to="/admin/vocab" className="font-semibold text-white underline">
            Import an Anki deck
          </Link>{" "}
          first.
        </Panel>
      ) : (
        <div className="space-y-3">
          {roots.map((deck) => (
            <AdminDeckNode
              key={deck.id}
              deck={deck}
              depth={0}
              childrenByParent={childrenByParent}
              onRenamed={() => void load()}
              onDeleted={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
