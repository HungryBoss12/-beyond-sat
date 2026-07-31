import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/panel";
import { DetailSkeleton } from "@/components/ui/skeletons";

type Article = {
  id: string;
  title: string;
  body: string;
  cover_image_url: string | null;
  published_at: string | null;
  excerpt: string | null;
};

export const Route = createFileRoute("/_authenticated/news/$slug")({
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = useParams({ from: "/_authenticated/news/$slug" });
  const [article, setArticle] = useState<Article | null | "missing">(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("id,title,body,cover_image_url,published_at,excerpt")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      setArticle((data as Article | null) ?? "missing");
    })();
  }, [slug]);

  if (article === null) {
    return <DetailSkeleton />;
  }
  if (article === "missing") {
    return (
      <EmptyState
        icon={<Newspaper className="h-8 w-8" />}
        title="Article not found"
        body="It may have been unpublished or the link is out of date."
        className="py-14"
        action={
          <Link
            to="/news"
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to News
          </Link>
        }
      />
    );
  }

  /* Long-form copy reads directly off the white page rather than out of a navy
     card, so the heading and body stay dark here — only the accents move onto
     the brand ramp. */
  return (
    <article className="rise-in mx-auto max-w-3xl">
      <Link
        to="/news"
        className="nudge inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> All news
      </Link>
      {article.published_at && (
        <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand-600">
          {format(new Date(article.published_at), "MMMM d, yyyy")}
        </div>
      )}
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
        {article.title}
      </h1>
      {article.cover_image_url && (
        <img
          src={article.cover_image_url}
          alt={article.title}
          className="mt-6 w-full rounded-2xl border border-brand-400/40 shadow-panel"
        />
      )}
      <div className="prose prose-slate mt-8 max-w-none whitespace-pre-wrap leading-relaxed text-slate-700">
        {article.body}
      </div>
    </article>
  );
}
