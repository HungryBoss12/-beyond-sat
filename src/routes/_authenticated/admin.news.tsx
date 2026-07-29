import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/admin";
import { Plus, Trash2, Edit3, X, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

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
  const [items, setItems] = useState<Article[]>([]);
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
    const payload: any = {
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New article
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No articles yet.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{a.title}</span>
                    <span
                      className={
                        "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " +
                        (a.published ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")
                      }
                    >
                      {a.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    /{a.slug} · Updated {format(new Date(a.updated_at), "MMM d, yyyy")}
                  </div>
                </div>
                <button
                  onClick={() => togglePublish(a)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
                  title={a.published ? "Unpublish" : "Publish"}
                >
                  {a.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setEditing(a)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(a.id)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editing.id ? "Edit article" : "New article"}
              </h3>
              <button onClick={() => setEditing(null)} className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <FieldRow label="Title">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.slug || slugify(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </FieldRow>
              <FieldRow label="Slug">
                <input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </FieldRow>
              <FieldRow label="Cover image URL (optional)">
                <input
                  value={editing.cover_image_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </FieldRow>
              <FieldRow label="Excerpt">
                <textarea
                  value={editing.excerpt ?? ""}
                  onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </FieldRow>
              <FieldRow label="Body">
                <textarea
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={10}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </FieldRow>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                />
                Published
              </label>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={save} className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90">Save</button>
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
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
