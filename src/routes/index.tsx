import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Layout, TrendingUp, GraduationCap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { CountUp } from "@/components/CountUp";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "BeyondSAT — Master the Digital SAT" },
      { name: "description", content: "Practice like it's test day. Track your progress. Reach your goal score with BeyondSAT's Digital SAT prep." },
    ],
  }),
});

type Section = { id: string; kind: string; position: number; visible: boolean; data: any };

const ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  Layout,
  TrendingUp,
  BookOpen,
  Sparkles,
};

function Landing() {
  const [sections, setSections] = useState<Section[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("homepage_sections")
        .select("*")
        .eq("visible", true)
        .order("position", { ascending: true });
      setSections((data as Section[]) ?? []);
    })();
  }, []);

  return (
    <div id="top" className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      {sections === null ? (
        <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-24 text-slate-400">Loading…</div>
      ) : (
        sections.map((s) => <SectionRenderer key={s.id} section={s} />)
      )}
      <SiteFooter />
    </div>
  );
}

function SectionRenderer({ section }: { section: Section }) {
  const d = section.data ?? {};
  switch (section.kind) {
    case "hero":
      return (
        <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-white">{d.title}</h1>
            {d.subtitle && <p className="mt-6 text-lg text-slate-600 max-w-xl">{d.subtitle}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {d.primary_cta_label && (
                <Link
                  to={d.primary_cta_href || "/signup"}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white soft-shadow hover:bg-[#002a56] transition"
                >
                  {d.primary_cta_label} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {d.secondary_cta_label && (
                <Link
                  to={d.secondary_cta_href || "/signin"}
                  className="inline-flex items-center rounded-lg border border-white px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  {d.secondary_cta_label}
                </Link>
              )}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[5/4] rounded-2xl bg-gradient-to-br from-[#E6EEF7] to-[#F5F7FA] soft-shadow p-8 flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-6 left-6 h-16 w-16 rounded-xl bg-white soft-shadow grid place-items-center">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute bottom-6 right-6 h-16 w-16 rounded-xl bg-white soft-shadow grid place-items-center">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div className="h-40 w-40 rounded-full bg-primary/10 grid place-items-center">
                <GraduationCap className="h-20 w-20 text-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>
      );
    case "stats":
      return (
        <section id="stats" className="bg-[#F5F7FA] py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {(d.items ?? []).map((s: any, i: number) => (
                <div key={i} className="rounded-2xl bg-white p-6 md:p-8 soft-shadow text-center">
                  <div className="text-4xl md:text-5xl font-bold text-primary">
                    <CountUp end={Number(s.n) || 0} suffix={s.s ?? ""} />
                  </div>
                  <div className="mt-3 text-sm text-slate-600">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "features":
      return (
        <section id="features" className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl">{d.title}</h2>
              {d.subtitle && <p className="mt-3 text-slate-600">{d.subtitle}</p>}
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(d.items ?? []).map((f: any, i: number) => {
                const Icon = ICONS[f.icon] ?? Sparkles;
                return (
                  <div key={i} className="rounded-2xl border border-border bg-white p-8 soft-shadow">
                    <div className="h-12 w-12 rounded-xl bg-accent grid place-items-center mb-5">
                      <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="text-lg font-semibold text-primary mb-2">{f.title}</div>
                    <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    case "how":
      return (
        <section id="how" className="bg-[#F5F7FA] py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl">{d.title}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(d.items ?? []).map((s: any, i: number) => (
                <div key={i} className="rounded-2xl bg-white p-8 soft-shadow">
                  <div className="h-12 w-12 rounded-full bg-primary text-white font-bold grid place-items-center text-lg mb-5">
                    {s.n}
                  </div>
                  <div className="text-lg font-semibold text-primary mb-2">{s.title}</div>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl bg-[#1A4C8B] text-center px-6 py-14 md:py-20 soft-shadow">
              <h2 className="text-3xl md:text-4xl text-white">{d.title}</h2>
              {d.button_label && (
                <div className="mt-8">
                  <Link
                    to={d.button_href || "/signup"}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-semibold text-primary hover:bg-white/90 transition soft-shadow"
                  >
                    {d.button_label} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    case "custom":
      return (
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            {d.title && <h2 className="text-3xl md:text-4xl">{d.title}</h2>}
            {d.body && <p className="mt-6 text-lg text-slate-600 whitespace-pre-line">{d.body}</p>}
            {d.button_label && (
              <div className="mt-8">
                <Link
                  to={d.button_href || "/"}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white soft-shadow hover:bg-[#002a56] transition"
                >
                  {d.button_label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>
      );
    default:
      return null;
  }
}
