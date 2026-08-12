import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/admin";
import { Plus, Trash2, Edit3, X, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  published: boolean;
  published_at: string | null;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/news")({
  component: AdminNews,
});

/** Shared control styling for the editor's inputs. */
const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

const empty = (): Article => ({
  id: "",
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  cover_image_url: "",
  published: false,
  published_at: null,
  updated_at: "",
});

function AdminNews() {
  const [items, setItems] = useState<Article[] | null>(null);
  const [editing, setEditing] = useState<Article | null>(null);

  async function load() {
    const { data } = await supabase
      .from("news_articles")
      .select("*")
      .order("updated_at", { ascending: false });
    setItems((data ?? []) as Article[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing) return;
    const slug = editing.slug || slugify(editing.title);
    const payload = {
      title: editing.title,
      slug,
      excerpt: editing.excerpt || null,
      body: editing.body,
      cover_image_url: editing.cover_image_url || null,
      published: editing.published,
      published_at: editing.published ? editing.published_at || new Date().toISOString() : null,
    };
    if (editing.id) {
      await supabase.from("news_articles").update(payload).eq("id", editing.id);
    } else {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("news_articles").insert({ ...payload, author_id: u.user?.id });
    }
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this article?")) return;
    await supabase.from("news_articles").delete().eq("id", id);
    load();
  }

  async function togglePublish(a: Article) {
    await supabase
      .from("news_articles")
      .update({
        published: !a.published,
        published_at: !a.published ? new Date().toISOString() : a.published_at,
      })
      .eq("id", a.id);
    load();
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => setEditing(empty())}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New article
        </button>
      </div>

      {items === null ? (
        <div className="mt-4">
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <div className="rise-in mt-4 overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">No articles yet.</div>
          ) : (
            <ul className="divide-y divide-brand-400/30">
              {items.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{a.title}</span>
                      {/* Published vs draft reads through the ramp's lightness. */}
                      <span
                        className={
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                          (a.published
                            ? "bg-brand-400 text-white"
                            : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40")
                        }
                      >
                        {a.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-brand-100">
                      /{a.slug} · Updated {format(new Date(a.updated_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <button
                    onClick={() => togglePublish(a)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                    title={a.published ? "Unpublish" : "Publish"}
                  >
                    {a.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setEditing(a)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                    aria-label="Edit article"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-900 hover:text-white"
                    aria-label="Delete article"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="pop-in my-8 w-full max-w-2xl rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
            <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
              <h3 className="text-lg font-bold text-white">
                {editing.id ? "Edit article" : "New article"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <FieldRow label="Title">
                <input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      title: e.target.value,
                      slug: editing.slug || slugify(e.target.value),
                    })
                  }
                  className={CONTROL_CLASS}
                />
              </FieldRow>
              <FieldRow label="Slug">
                <input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  className={CONTROL_CLASS + " font-mono"}
                />
              </FieldRow>
              <FieldRow label="Cover image URL (optional)">
                <input
                  value={editing.cover_image_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })}
                  className={CONTROL_CLASS}
                />
              </FieldRow>
              <FieldRow label="Excerpt">
                <textarea
                  value={editing.excerpt ?? ""}
                  onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                  rows={2}
                  className={CONTROL_CLASS}
                />
              </FieldRow>
              <FieldRow label="Body">
                <textarea
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={10}
                  className={CONTROL_CLASS}
                />
              </FieldRow>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                {/* accent-color keeps the native checkbox on-palette when checked. */}
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                  className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
                />
                Published
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-brand-400/30 px-6 py-4">
              <button
                onClick={() => setEditing(null)}
                className="tap rounded-lg px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
        {label}
      </span>
      {children}
    </label>
  );
}
