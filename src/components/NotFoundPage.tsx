import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useEffect } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientGlow } from "@/components/ui/reveal-card";
import { BeyondCore } from "@/components/landing/BeyondCore";
import { SatPracticeWidget } from "@/components/not-found/SatPracticeWidget";

type NotFoundPageProps = {
  layout?: "full" | "content";
};

function NotFoundContent() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
      <div className="rise-in order-2 lg:order-1">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
          Error 404
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
          Good luck finding that!
        </h1>
        <p className="mt-5 max-w-lg text-base text-slate-500">
          Even Beyond AI couldn&apos;t find this page. Looks like it got omitted from the test booklet.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="not-found-outline-btn tap inline-flex cursor-pointer items-center rounded-full border-2 border-brand-600 bg-white px-6 py-3 text-sm font-bold text-brand-600"
          >
            Start Practicing
          </Link>
          <a
            href="mailto:support@beyondsat.com"
            className="not-found-outline-btn tap inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-brand-600 bg-white px-6 py-3 text-sm font-bold text-brand-600"
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </a>
        </div>

        <div className="mt-10">
          <SatPracticeWidget />
        </div>
      </div>

      <div className="order-1 flex items-center justify-center lg:order-2">
        <BeyondCore />
      </div>
    </main>
  );
}

export function NotFoundPage({ layout = "full" }: NotFoundPageProps) {
  useEffect(() => {
    const prev = document.title;
    document.title = "404 — Good luck finding that! | BeyondSAT";
    return () => {
      document.title = prev;
    };
  }, []);

  if (layout === "content") {
    return (
      <div className="w-full py-4 md:py-8">
        <NotFoundContent />
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-white">
      <AmbientGlow />
      <SiteNav />
      <NotFoundContent />
      <SiteFooter />
    </div>
  );
}
