import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cardsFromFile,
  cardsFromPaste,
  deleteOwnedDeck,
  fetchMyDecks,
  saveOwnedDeck,
  submitForReview,
  type OwnedDeck,
} from "@/lib/vocab/user-content";
import type { GeneratedVocabItem } from "@/lib/vocab/types";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400";

export function YourDecks() {
  const [decks, setDecks] = useState<OwnedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OwnedDeck | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDecks(await fetchMyDecks());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your decks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(deck: OwnedDeck) {
    if (!window.confirm(`Delete "${deck.title}"?`)) return;
    try {
      await deleteOwnedDeck(deck.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the deck");
    }
  }

  async function apply(deck: OwnedDeck) {
    try {
      await submitForReview("deck", deck.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the deck");
    }
  }

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Your decks</h2>
          <p className="mt-1 text-sm text-brand-100">
            Private until you apply for checking. They stay off the main list until an admin accepts them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="tap shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50"
        >
          New deck
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand-100" />
        </div>
      ) : decks.length === 0 ? (
        <p className="mt-4 text-sm text-brand-100">No private decks yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {decks.map((deck) => (
            <li
              key={deck.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-800/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{deck.title}</p>
                <p className="text-xs text-brand-100">
                  {deck.visibility === "pending" ? "Waiting for review" : "Private"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(deck);
                    setOpen(true);
                  }}
                  className="tap rounded-lg px-2.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/30 hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove(deck)}
                  className="tap rounded-lg px-2.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/30 hover:bg-white/10"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={deck.visibility === "pending"}
                  onClick={() => void apply(deck)}
                  className="tap rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-brand-700 disabled:opacity-50"
                >
                  {deck.visibility === "pending" ? "Sent" : "Apply for checking"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DeckDialog
        open={open}
        deck={editing}
        onOpenChange={setOpen}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </Panel>
  );
}

function DeckDialog({
  open,
  deck,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  deck: OwnedDeck | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [paste, setPaste] = useState("");
  const [items, setItems] = useState<GeneratedVocabItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(deck?.title ?? "");
    setPaste("");
    setItems([]);
    setError(null);
  }, [open, deck]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await cardsFromFile(file);
      setItems(parsed);
      if (!title.trim()) setTitle(file.name.replace(/\.(apkg|colpkg)$/i, ""));
      if (!parsed.length) setError("That file had no cards.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file");
    } finally {
      setBusy(false);
    }
  }

  function onPasteChange(value: string) {
    setPaste(value);
    setItems(cardsFromPaste(value));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveOwnedDeck({ deckId: deck?.id, title, items });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the deck");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>{deck ? "Edit deck" : "New deck"}</DialogTitle>
          <DialogDescription>
            Paste one card per line (word - definition) or drop an Anki .apkg or .colpkg file.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm font-semibold text-slate-700">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field + " mt-1"} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Paste cards
          <textarea
            value={paste}
            onChange={(e) => onPasteChange(e.target.value)}
            rows={5}
            placeholder={"ephemeral - lasting a very short time\nmalleable | easy to shape"}
            className={field + " mt-1 font-mono"}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Or a file
          <input
            type="file"
            accept=".apkg,.colpkg"
            className="mt-1 block w-full text-sm"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        {items.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-700">
            {items.slice(0, 12).map((item) => (
              <li key={item.word}>
                <span className="font-semibold">{item.word}</span>
                <span className="text-slate-500"> — {item.definition}</span>
              </li>
            ))}
            {items.length > 12 ? <li className="text-slate-500">+ {items.length - 12} more</li> : null}
          </ul>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="tap inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {deck ? "Save changes" : "Create deck"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
