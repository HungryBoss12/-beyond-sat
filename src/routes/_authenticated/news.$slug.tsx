import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
    return <div className="h-64 rounded-2xl bg-white border border-border animate-pulse" />;
  }
  if (article === "missing") {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <h1 className="text-xl font-bold text-slate-800">Article not found</h1>
        <Link to="/news" className="mt-3 inline-block text-sm font-semibold text-primary">
          ← Back to News
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto">
      <Link
        to="/news"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> All news
      </Link>
      {article.published_at && (
        <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary/70">
          {format(new Date(article.published_at), "MMMM d, yyyy")}
        </div>
      )}
      <h1 className="mt-2 text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
        {article.title}
      </h1>
      {article.cover_image_url && (
        <img
          src={article.cover_image_url}
          alt={article.title}
          className="mt-6 w-full rounded-2xl border border-border"
        />
      )}
      <div className="mt-8 prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 leading-relaxed">
        {article.body}
      </div>
    </article>
  );
}
