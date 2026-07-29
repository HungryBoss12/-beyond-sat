import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Layout,
  TrendingUp,
  GraduationCap,
  Sparkles,
  Target,
  Users,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { CountUp } from "@/components/CountUp";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Target,
  Users,
  ShieldCheck,
};

/** Social proof faces. Avatar falls back to initials if the CDN is unreachable. */
const AVATARS = [
  { src: "https://i.pravatar.cc/64?img=12", initials: "AR" },
  { src: "https://i.pravatar.cc/64?img=32", initials: "MK" },
  { src: "https://i.pravatar.cc/64?img=45", initials: "JL" },
  { src: "https://i.pravatar.cc/64?img=68", initials: "SD" },
];

/**
 * Splits the headline on `highlight` so that part can render in a blue gradient.
 * Falls back to the plain title when the substring isn't present.
 */
function HeadlineParts({ title, highlight }: { title: string; highlight?: string }) {
  const needle = (highlight ?? "").trim();
  const at = needle ? title.indexOf(needle) : -1;
  if (at === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
        {needle}
      </span>
      {title.slice(at + needle.length)}
    </>
  );
}

/**
 * Section links are admin-authored, so they may be an app route ("/signup"), a
 * same-page anchor ("#features") or an external URL. TanStack's <Link to> only
 * handles the first, so anything else falls back to a plain <a>.
 */
function CtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const isInternalRoute = href.startsWith("/") && !href.startsWith("//");
  if (!isInternalRoute) {
    return (
      <a
        href={href}
        className={className}
        {...(/^https?:/i.test(href) ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

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
    <div id="top" className="min-h-screen flex flex-col bg-white">
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
        <section className="bg-gradient-to-b from-slate-50 to-white">
          <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-16 md:py-20 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold leading-[1.08] tracking-tight text-slate-900">
                <HeadlineParts title={d.title ?? ""} highlight={d.highlight ?? "Digital SAT"} />
              </h1>

              {d.subtitle && (
                <p className="mt-5 text-base text-slate-500 max-w-lg">{d.subtitle}</p>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                {d.primary_cta_label && (
                  <CtaLink
                    href={d.primary_cta_href || "/signup"}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    {d.primary_cta_label} <ArrowRight className="h-4 w-4" />
                  </CtaLink>
                )}
                {d.secondary_cta_label && (
                  <CtaLink
                    href={d.secondary_cta_href || "/signin"}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition"
                  >
                    {d.secondary_cta_label}
                  </CtaLink>
                )}
              </div>

              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {AVATARS.map((a) => (
                    <Avatar key={a.src} className="h-9 w-9 ring-2 ring-white">
                      <AvatarImage src={a.src} alt="" />
                      <AvatarFallback className="bg-blue-100 text-[11px] font-semibold text-blue-700">
                        {a.initials}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  Trusted by <span className="font-semibold text-slate-700">50,000+</span> students
                  worldwide
                </p>
              </div>
            </div>

            <DashboardMockup />
          </div>
        </section>
      );
    case "stats":
      return (
        <section id="stats" className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 md:p-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
                {(d.items ?? []).map((s: any, i: number) => {
                  const Icon = ICONS[s.icon] ?? Sparkles;
                  return (
                    <div key={i} className="flex flex-col items-center text-center lg:items-start lg:text-left">
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-5 w-5 shrink-0 text-blue-600" strokeWidth={2} />
                        <div className="text-3xl md:text-4xl font-bold text-blue-600">
                          <CountUp end={Number(s.n) || 0} suffix={s.s ?? ""} />
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-[16rem]">
                        {s.l}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      );
    case "press":
      return (
        <section className="bg-white pb-12 md:pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-10">
              {d.label && (
                <span className="shrink-0 text-sm text-slate-400">{d.label}</span>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {(d.items ?? []).map((p: any, i: number) => (
                  <span
                    key={i}
                    className="text-lg font-bold tracking-tight text-slate-400 grayscale transition hover:text-slate-600"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      );
    case "features":
      return (
        <section id="features" className="bg-white py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl text-slate-900">{d.title}</h2>
              {d.subtitle && <p className="mt-3 text-slate-500">{d.subtitle}</p>}
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(d.items ?? []).map((f: any, i: number) => {
                const Icon = ICONS[f.icon] ?? Sparkles;
                return (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 grid place-items-center mb-5">
                      <Icon className="h-6 w-6 text-blue-600" strokeWidth={1.75} />
                    </div>
                    <div className="text-lg font-semibold text-slate-900 mb-2">{f.title}</div>
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
        <section id="how" className="bg-slate-50 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl text-slate-900">{d.title}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(d.items ?? []).map((s: any, i: number) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="h-12 w-12 rounded-full bg-blue-600 text-white font-bold grid place-items-center text-lg mb-5">
                    {s.n}
                  </div>
                  <div className="text-lg font-semibold text-slate-900 mb-2">{s.title}</div>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="bg-white py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 text-center px-6 py-14 md:py-20 shadow-md">
              <h2 className="text-3xl md:text-4xl text-white">{d.title}</h2>
              {d.button_label && (
                <div className="mt-8">
                  <CtaLink
                    href={d.button_href || "/signup"}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-600 hover:bg-blue-50 transition shadow-sm"
                  >
                    {d.button_label} <ArrowRight className="h-4 w-4" />
                  </CtaLink>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    case "custom":
      return (
        <section className="bg-white py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            {d.title && <h2 className="text-3xl md:text-4xl text-slate-900">{d.title}</h2>}
            {d.body && <p className="mt-6 text-lg text-slate-600 whitespace-pre-line">{d.body}</p>}
            {d.button_label && (
              <div className="mt-8">
                <CtaLink
                  href={d.button_href || "/"}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  {d.button_label} <ArrowRight className="h-4 w-4" />
                </CtaLink>
              </div>
            )}
          </div>
        </section>
      );
    default:
      return null;
  }
}
