import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Newspaper, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { EmptyState, PageHead } from "@/components/ui/panel";
import { CardGridSkeleton } from "@/components/ui/skeletons";

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
      {/* PageHead keeps dark text — it sits on the white page background, where the
          old text-white heading was invisible. */}
      <PageHead title="News" subtitle="Announcements and study tips from BeyondSAT." />

      {items === null ? (
        <div className="mt-8">
          <CardGridSkeleton count={4} height={200} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-8 w-8" />}
          title="Nothing here yet"
          body="Check back soon."
          className="mt-8 py-12"
        />
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {items.map((a) => (
            <Link
              key={a.id}
              to="/news/$slug"
              params={{ slug: a.slug }}
              className="lift group overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel transition-colors hover:border-brand-200/60"
            >
              {a.cover_image_url ? (
                <div className="aspect-[16/9] overflow-hidden bg-brand-800">
                  <img
                    src={a.cover_image_url}
                    alt={a.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] grid place-items-center bg-grad-brand">
                  <Newspaper className="h-10 w-10 text-brand-100" />
                </div>
              )}
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-200">
                  {a.published_at ? format(new Date(a.published_at), "MMM d, yyyy") : ""}
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-white">{a.title}</h2>
                {a.excerpt && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-brand-100">{a.excerpt}</p>
                )}
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white">
                  Read <ArrowRight className="arrow-slide h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
