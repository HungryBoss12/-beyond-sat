import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Newspaper, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
};

export const Route = createFileRoute("/_authenticated/news")({
  component: News,
  head: () => ({
    meta: [
      { title: "News — BeyondSAT" },
      { name: "description", content: "Latest announcements and study tips from BeyondSAT." },
    ],
  }),
});

function News() {
  const [items, setItems] = useState<Article[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("id,title,slug,excerpt,cover_image_url,published_at")
        .eq("published", true)
        .order("published_at", { ascending: false });
      setItems((data ?? []) as Article[]);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">News</h1>
      <p className="text-sm text-slate-600 mt-1">Announcements and study tips from BeyondSAT.</p>

      {items === null ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Newspaper className="h-8 w-8 text-slate-400 mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-slate-800">Nothing here yet</h2>
          <p className="text-sm text-slate-500 mt-1">Check back soon.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {items.map((a) => (
            <Link
              key={a.id}
              to="/news/$slug"
              params={{ slug: a.slug }}
              className="group rounded-2xl overflow-hidden border border-slate-200 bg-white hover:border-blue-600/40 transition soft-shadow"
            >
              {a.cover_image_url ? (
                <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                  <img
                    src={a.cover_image_url}
                    alt={a.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-primary/5 grid place-items-center">
                  <Newspaper className="h-10 w-10 text-blue-600/40" />
                </div>
              )}
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-600/70">
                  {a.published_at ? format(new Date(a.published_at), "MMM d, yyyy") : ""}
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-slate-800 group-hover:text-blue-600">
                  {a.title}
                </h2>
                {a.excerpt && (
                  <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{a.excerpt}</p>
                )}
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                  Read <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
