import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientGlow } from "@/components/ui/reveal-card";

/** Scroll to `location.hash` after navigation (footer / Resources deep links). */
export function useHashScroll() {
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    const id = hash?.replace(/^#/, "");
    if (!id) {
      window.scrollTo({ top: 0 });
      return;
    }
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [hash]);
}

export function MarketingShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  /** Wider content column for multi-section pages */
  wide?: boolean;
}) {
  useHashScroll();

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-white">
      <AmbientGlow />
      <SiteNav />
      <main
        className={
          wide
            ? "relative mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 md:py-16"
            : "relative mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 md:py-16"
        }
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function MarketingHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-10 md:mb-14">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      ) : null}
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-base text-slate-600 md:text-lg">{subtitle}</p>
    </header>
  );
}

export function MarketingSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-brand-100 py-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 md:text-base">{children}</div>
    </section>
  );
}

export function MarketingCta({
  to = "/signup",
  label = "Sign up free",
}: {
  to?: "/signup" | "/signin";
  label?: string;
}) {
  return (
    <p className="mt-8">
      <Link
        to={to}
        className="btn-brand inline-flex rounded-lg bg-brand-400 px-5 py-2.5 text-sm font-bold text-white"
      >
        {label}
      </Link>
    </p>
  );
}
