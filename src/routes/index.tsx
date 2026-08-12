import { createFileRoute, Link } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  Check,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { CountUp } from "@/components/CountUp";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { BeyondCore } from "@/components/landing/BeyondCore";
import { SectionSkeleton } from "@/components/ui/skeletons";
import { RevealCard, AmbientGlow } from "@/components/ui/reveal-card";
import { MathText } from "@/components/MathText";
import { useInView, useScrollProgress } from "@/hooks/useInView";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "BeyondSAT — Master the Digital SAT" },
      {
        name: "description",
        content:
          "Practice like it's test day. Track your progress. Reach your goal score with BeyondSAT's Digital SAT prep.",
      },
    ],
  }),
});

type Section = { id: string; kind: string; position: number; visible: boolean; data: Json };
type SectionData = Record<string, Json | undefined>;

function asSectionData(data: Json | null | undefined): SectionData {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as SectionData;
  }
  return {};
}

function dataItems(data: SectionData, key = "items"): SectionData[] {
  const raw = data[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is SectionData => typeof x === "object" && x !== null && !Array.isArray(x),
  );
}

function dataMessages(data: SectionData): SectionData[] {
  return dataItems(data, "messages");
}

function jsonText(v: Json | undefined, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

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
      {/* The gradient text stop must stay inside the brand family. */}
      <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
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

  /* `isolate` on the root is load-bearing: it makes this element a stacking
     context so AmbientGlow's z-index:-1 resolves above this div's white
     background rather than escaping to the root and painting behind the page.
     For the same reason the sections below no longer set their own `bg-white` —
     an opaque section background would cover the glow completely. */
  return (
    <div id="top" className="relative isolate flex min-h-screen flex-col bg-white">
      {/* Cursor spotlight. Sits at the page root — it's position:fixed, so any
          ancestor with an animated transform would become its containing block
          and collapse it. Behind everything via z-0 + the sections' own stacking. */}
      <AmbientGlow />
      <SiteNav />
      {sections === null ? (
        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
          <SectionSkeleton />
        </div>
      ) : (
        sections.map((s) => <SectionRenderer key={s.id} section={s} />)
      )}
      <SiteFooter />
    </div>
  );
}

function SectionRenderer({ section }: { section: Section }) {
  const d = asSectionData(section.data);
  switch (section.kind) {
    case "hero":
      return (
        /* The hero is above the fold, so it keeps its mount animation — gating it
           on IntersectionObserver would hold the first thing a visitor sees until
           an observer callback fires. `HeroProgress` only publishes `--p` so the
           emblem column can drift as the page leaves. */
        <HeroProgress>
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-2 lg:gap-12">
            <div className="rise-in">
              {/* Headings sit on the white page, so they stay dark; every card
                  below them is a brand surface with white text. */}
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
                <HeadlineParts
                  title={jsonText(d.title)}
                  highlight={jsonText(d.highlight, "Digital SAT")}
                />
              </h1>

              {jsonText(d.subtitle) && (
                <p className="mt-5 max-w-lg text-base text-slate-500">{jsonText(d.subtitle)}</p>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                {jsonText(d.primary_cta_label) && (
                  <CtaLink
                    href={jsonText(d.primary_cta_href, "/signup")}
                    className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white"
                  >
                    {jsonText(d.primary_cta_label)} <ArrowRight className="arrow-slide h-4 w-4" />
                  </CtaLink>
                )}
                {jsonText(d.secondary_cta_label) && (
                  <CtaLink
                    href={jsonText(d.secondary_cta_href, "/signin")}
                    className="tap inline-flex items-center rounded-lg border border-brand-600 bg-white px-6 py-3 text-sm font-bold text-brand-600 transition hover:bg-brand-600 hover:text-white"
                  >
                    {jsonText(d.secondary_cta_label)}
                  </CtaLink>
                )}
              </div>

              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {AVATARS.map((a) => (
                    <Avatar key={a.src} className="h-9 w-9 ring-2 ring-white">
                      <AvatarImage src={a.src} alt="" />
                      <AvatarFallback className="bg-brand-600 text-[11px] font-bold text-white">
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

            {/* Drifts down as the hero scrolls away, so the emblem and the copy
                separate slightly instead of leaving as one block. */}
            <div className="parallax-drift">
              <BeyondCore />
            </div>
          </div>
        </HeroProgress>
      );
    case "stats":
      return (
        <Reveal as="section" from="scale" id="stats" className="py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <RevealCard className="rounded-2xl border border-brand-400/40 bg-brand-600 p-6 shadow-panel md:p-10">
              <StaggerGrid className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {dataItems(d).map((s, i) => {
                  const Icon = ICONS[String(s.icon ?? "")] ?? Sparkles;
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center text-center lg:items-start lg:text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-5 w-5 shrink-0 text-brand-100" strokeWidth={2} />
                        <div className="text-3xl font-black text-white md:text-4xl">
                          <CountUp end={Number(s.n) || 0} suffix={String(s.s ?? "")} />
                        </div>
                      </div>
                      <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-brand-100">
                        {String(s.l ?? "")}
                      </p>
                    </div>
                  );
                })}
              </StaggerGrid>
            </RevealCard>
          </div>
        </Reveal>
      );
    case "press":
      return (
        <Reveal as="section" from="fade" className="pb-12 md:pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-10">
              {jsonText(d.label) && (
                <span className="shrink-0 text-sm text-slate-500">{jsonText(d.label)}</span>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {dataItems(d).map((p, i) => (
                  <span
                    key={i}
                    className="text-lg font-bold tracking-tight text-brand-200 transition hover:text-brand-600"
                  >
                    {String(p.name ?? "")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      );
    case "features":
      return (
        <Reveal as="section" from="left" id="features" className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="parallax-rise mb-12 text-center">
              <h2 className="text-3xl text-slate-900 md:text-4xl">{jsonText(d.title)}</h2>
              {jsonText(d.subtitle) && (
                <p className="mt-3 text-slate-500">{jsonText(d.subtitle)}</p>
              )}
            </div>
            <StaggerGrid className="grid gap-6 md:grid-cols-3">
              {dataItems(d).map((f, i) => {
                const Icon = ICONS[String(f.icon ?? "")] ?? Sparkles;
                return (
                  <RevealCard
                    key={i}
                    className="lift rounded-2xl border border-brand-400/40 bg-brand-600 p-8 shadow-panel"
                  >
                    <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-brand-400">
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="mb-2 text-lg font-bold text-white">{String(f.title ?? "")}</div>
                    <p className="text-sm leading-relaxed text-brand-100">
                      {String(f.description ?? "")}
                    </p>
                  </RevealCard>
                );
              })}
            </StaggerGrid>
          </div>
        </Reveal>
      );
    case "how":
      return (
        <Reveal as="section" from="right" id="how" className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="parallax-rise mb-12 text-center">
              <h2 className="text-3xl text-slate-900 md:text-4xl">{String(d.title ?? "")}</h2>
            </div>
            <StaggerGrid className="grid gap-6 md:grid-cols-3">
              {dataItems(d).map((s, i) => (
                <RevealCard
                  key={i}
                  className="lift rounded-2xl border border-brand-400/40 bg-brand-600 p-8 shadow-panel"
                >
                  <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-brand-400 text-lg font-black text-white">
                    {jsonText(s.n)}
                  </div>
                  <div className="mb-2 text-lg font-bold text-white">{jsonText(s.title)}</div>
                  <p className="text-sm leading-relaxed text-brand-100">
                    {jsonText(s.description)}
                  </p>
                </RevealCard>
              ))}
            </StaggerGrid>
          </div>
        </Reveal>
      );
    case "cta":
      return (
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rise-in relative overflow-hidden rounded-3xl bg-grad-brand px-6 py-14 text-center shadow-brand md:py-20">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div className="drift absolute -right-24 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
              </div>
              <h2 className="relative text-3xl text-white md:text-4xl">{jsonText(d.title)}</h2>
              {jsonText(d.button_label) && (
                <div className="relative mt-8">
                  <CtaLink
                    href={jsonText(d.button_href, "/signup")}
                    className="tap inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-bold text-brand-600 shadow-float hover:bg-brand-50"
                  >
                    {jsonText(d.button_label)} <ArrowRight className="h-4 w-4" />
                  </CtaLink>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    case "custom":
      return (
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            {jsonText(d.title) && (
              <h2 className="text-3xl text-slate-900 md:text-4xl">{jsonText(d.title)}</h2>
            )}
            {jsonText(d.body) && (
              <p className="mt-6 whitespace-pre-line text-lg text-slate-600">{jsonText(d.body)}</p>
            )}
            {jsonText(d.button_label) && (
              <div className="mt-8">
                <CtaLink
                  href={jsonText(d.button_href, "/")}
                  className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white"
                >
                  {jsonText(d.button_label)} <ArrowRight className="arrow-slide h-4 w-4" />
                </CtaLink>
              </div>
            )}
          </div>
        </section>
      );
    case "showcase":
      return (
        /* `blur` rather than a slide: this section's job is "look at the product",
           and coming into focus says that where arriving from an edge doesn't. */
        <Reveal as="section" from="blur" id="showcase" className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {(jsonText(d.title) || jsonText(d.subtitle)) && (
              <div className="parallax-rise mb-12 text-center">
                {jsonText(d.title) && (
                  <h2 className="text-3xl text-slate-900 md:text-4xl">{jsonText(d.title)}</h2>
                )}
                {jsonText(d.subtitle) && (
                  <p className="mt-3 text-slate-500">{jsonText(d.subtitle)}</p>
                )}
              </div>
            )}
            {/* The 2D mockup that used to be the hero visual. It's more use here,
                where there's room to read it, than squeezed beside the headline. */}
            <div className="mx-auto max-w-4xl">
              <DashboardMockup />
            </div>
          </div>
        </Reveal>
      );

    case "ai_demo":
      return (
        /* The only section whose halves arrive separately: the copy comes in from
           the left and the transcript from the right, so they meet in the middle.
           The outer Reveal animates nothing — it publishes `--p` and gates the two
           nested ones. */
        <Reveal as="section" from="none" id="ai" className="py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14">
            <Reveal as="div" from="left">
              {jsonText(d.eyebrow) && (
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
                  <Sparkles className="h-3.5 w-3.5" /> {jsonText(d.eyebrow)}
                </span>
              )}
              {jsonText(d.title) && (
                <h2 className="mt-4 text-3xl text-slate-900 md:text-4xl">{jsonText(d.title)}</h2>
              )}
              {jsonText(d.subtitle) && (
                <p className="mt-4 max-w-lg text-slate-500">{jsonText(d.subtitle)}</p>
              )}
              {dataItems(d).length > 0 && (
                <ul className="mt-7 space-y-3">
                  {dataItems(d).map((b, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="text-sm text-slate-600">
                        {String(b.text ?? b.title ?? "")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {jsonText(d.button_label) && (
                <CtaLink
                  href={jsonText(d.button_href, "/signup")}
                  className="btn-brand mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white"
                >
                  {jsonText(d.button_label)} <ArrowRight className="arrow-slide h-4 w-4" />
                </CtaLink>
              )}
            </Reveal>

            {/* A scripted transcript, not a live call: this section renders for
                logged-out visitors, and /api/ai/chat requires a session. */}
            <Reveal as="div" from="right">
              <RevealCard className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-400 text-white">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold text-white">
                    {jsonText(d.chat_title, "Beyond AI")}
                  </span>
                </div>
                <div className="space-y-3">
                  {dataMessages(d).map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="flex justify-end">
                        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-400 px-3.5 py-2.5 text-sm text-white">
                          {String(m.text ?? "")}
                        </p>
                      </div>
                    ) : (
                      <div key={i} className="flex justify-start">
                        <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-brand-800 px-3.5 py-2.5">
                          {/* MathText so a scripted answer can carry real LaTeX,
                              same renderer the live chat uses. */}
                          <MathText block className="ai-prose text-sm text-brand-100">
                            {String(m.text ?? "")}
                          </MathText>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </RevealCard>
            </Reveal>
          </div>
        </Reveal>
      );

    case "programs":
      return (
        <Reveal as="section" from="scale" id="programs" className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="parallax-rise mb-12 text-center">
              {jsonText(d.title) && (
                <h2 className="text-3xl text-slate-900 md:text-4xl">{jsonText(d.title)}</h2>
              )}
              {jsonText(d.subtitle) && (
                <p className="mt-3 text-slate-500">{jsonText(d.subtitle)}</p>
              )}
            </div>
            <StaggerGrid className="grid gap-6 md:grid-cols-3">
              {dataItems(d).map((p, i) => {
                const Icon = ICONS[String(p.icon ?? "")] ?? GraduationCap;
                return (
                  <RevealCard
                    key={i}
                    className="lift flex flex-col rounded-2xl border border-brand-400/40 bg-brand-600 p-7 shadow-panel"
                  >
                    <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-brand-400">
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="text-lg font-bold text-white">{jsonText(p.title)}</div>
                    {jsonText(p.duration) && (
                      <div className="mt-1 text-xs font-bold uppercase tracking-wider text-brand-200">
                        {jsonText(p.duration)}
                      </div>
                    )}
                    {jsonText(p.description) && (
                      <p className="mt-3 text-sm leading-relaxed text-brand-100">
                        {jsonText(p.description)}
                      </p>
                    )}
                    {jsonText(p.button_label) && (
                      <CtaLink
                        href={jsonText(p.button_href, "/signup")}
                        className="tap mt-6 inline-flex w-fit items-center gap-2 rounded-lg border border-brand-200/60 px-4 py-2 text-xs font-bold text-white hover:bg-brand-800"
                      >
                        {jsonText(p.button_label)} <ArrowRight className="h-3.5 w-3.5" />
                      </CtaLink>
                    )}
                  </RevealCard>
                );
              })}
            </StaggerGrid>
          </div>
        </Reveal>
      );

    case "reviews":
      return (
        <Reveal as="section" from="scale" id="reviews" className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="parallax-rise mb-12 text-center">
              {jsonText(d.title) && (
                <h2 className="text-3xl text-slate-900 md:text-4xl">{jsonText(d.title)}</h2>
              )}
              {jsonText(d.subtitle) && (
                <p className="mt-3 text-slate-500">{jsonText(d.subtitle)}</p>
              )}
            </div>
            <StaggerGrid className="grid gap-6 md:grid-cols-3">
              {dataItems(d).map((r, i) => (
                <RevealCard
                  key={i}
                  className="lift flex flex-col rounded-2xl border border-brand-400/40 bg-brand-600 p-7 shadow-panel"
                >
                  {/* Stars are clamped to 0-5 so a bad admin value can't render
                      forty icons and blow out the card. */}
                  <div className="mb-4 flex gap-0.5" aria-label={`${clampStars(r.stars)} out of 5`}>
                    {Array.from({ length: clampStars(r.stars) }).map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-white text-white" />
                    ))}
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-white">
                    “{String(r.quote ?? "")}”
                  </p>
                  <div className="mt-5 flex items-center gap-3 border-t border-brand-400/40 pt-4">
                    <Avatar className="h-9 w-9">
                      {r.avatar && <AvatarImage src={String(r.avatar)} alt="" />}
                      <AvatarFallback className="bg-brand-400 text-[11px] font-bold text-white">
                        {initials(r.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {String(r.name ?? "")}
                      </div>
                      {r.detail && (
                        <div className="truncate text-xs text-brand-100">{String(r.detail)}</div>
                      )}
                    </div>
                  </div>
                </RevealCard>
              ))}
            </StaggerGrid>
          </div>
        </Reveal>
      );

    /**
     * The "it's free" band.
     *
     * This replaced a three-tier pricing table. Beyond SAT has no paid plan, no
     * subscription and no gated content, so a tier grid was advertising a product
     * that doesn't exist — and a "Free" column implies the others aren't. One
     * unambiguous statement is both more honest and a stronger pitch.
     */
    case "free":
      return (
        /* Held longer than the sections above it — it's the last thing on the page
           before the footer, so it lands rather than passes. */
        <Reveal as="section" from="scale-hold" id="free" className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <RevealCard className="relative overflow-hidden rounded-3xl border border-brand-400/50 bg-grad-brand p-8 text-center shadow-brand md:p-14">
              {jsonText(d.eyebrow) && (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white ring-1 ring-white/25">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {jsonText(d.eyebrow)}
                </div>
              )}
              {jsonText(d.title) && (
                <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black tracking-tight text-white md:text-5xl">
                  {jsonText(d.title)}
                </h2>
              )}
              {jsonText(d.subtitle) && (
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100">
                  {jsonText(d.subtitle)}
                </p>
              )}

              {dataItems(d).length > 0 && (
                <StaggerGrid className="mx-auto mt-10 grid max-w-3xl gap-x-8 gap-y-3 text-left sm:grid-cols-2">
                  {dataItems(d).map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-white">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-brand-700">
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      </span>
                      <span>{typeof f === "string" ? f : String(f.text ?? "")}</span>
                    </div>
                  ))}
                </StaggerGrid>
              )}

              {jsonText(d.button_label) && (
                <CtaLink
                  href={jsonText(d.button_href, "/signup")}
                  className="tap mt-10 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-bold text-brand-700 hover:bg-brand-50"
                >
                  {jsonText(d.button_label)} <ArrowRight className="arrow-slide h-4 w-4" />
                </CtaLink>
              )}
              {jsonText(d.footnote) && (
                <p className="mt-5 text-xs text-brand-100">{jsonText(d.footnote)}</p>
              )}
            </RevealCard>
          </div>
        </Reveal>
      );

    default:
      return null;
  }
}

/** Star counts come from admin input, so they're clamped to a sane range. */
function clampStars(n: unknown): number {
  const parsed = Math.round(Number(n));
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(5, Math.max(0, parsed));
}

/** Two-letter fallback for a review avatar that fails to load. */
function initials(name: unknown): string {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Which path a section takes on arrival. Sections alternate deliberately: one
 * repeated move down a page this long reads as a template, where alternating
 * directions read as a sequence someone authored.
 */
type RevealFrom = "up" | "left" | "right" | "scale" | "scale-hold" | "blur" | "fade" | "none";

const FROM_CLASS: Record<RevealFrom, string> = {
  up: "rise-in",
  left: "slide-from-left",
  right: "slide-from-right",
  scale: "zoom-in-soft",
  "scale-hold": "zoom-in-hold",
  blur: "unblur-in",
  fade: "fade-in",
  /* For a section whose halves animate separately: the wrapper still publishes
     `--p` and gates the nested reveals, but moves nothing itself. Two entrances
     on the same element read as a stumble. */
  none: "",
};

/**
 * A section that plays its entrance animation when it scrolls into view.
 *
 * The `rise-in` / `stagger` utilities animate on mount, which is correct for the
 * hero and wrong for everything below the fold — those sections would finish
 * animating before the visitor ever reaches them. Adding the class only once the
 * element is in view fixes that without a new animation library.
 */
function Reveal({
  as: Tag = "section",
  from = "up",
  className,
  children,
  ...rest
}: {
  as?: "section" | "div";
  from?: RevealFrom;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const { ref, inView } = useInView<HTMLElement>();
  /* The same element also publishes its scroll progress as `--p`, which any
     descendant with `parallax-rise` / `parallax-drift` picks up by inheritance.
     One observer and one rAF handler per section rather than per moving part. */
  const progressRef = useScrollProgress<HTMLElement>();

  const attach = useCallback(
    (node: HTMLElement | null) => {
      ref.current = node;
      progressRef.current = node;
    },
    [ref, progressRef],
  );

  return (
    <RevealContext.Provider value={inView}>
      <Tag
        ref={attach as React.Ref<never>}
        className={`${className ?? ""}${inView ? ` ${FROM_CLASS[from]}` : ""}`}
        {...rest}
      >
        {children}
      </Tag>
    </RevealContext.Provider>
  );
}

/**
 * Whether the enclosing <Reveal> has scrolled into view.
 *
 * This exists so the grid inside a section can hold its `stagger` back until the
 * same moment the section itself animates. Without it the two are driven by
 * different clocks — `stagger` fires on mount, so the cards would finish their
 * entrance while still off-screen and the visitor would arrive to a static grid
 * inside a fading-in wrapper. Context rather than a prop because the grid is
 * usually several elements deep.
 */
const RevealContext = createContext(false);

/** The card grid inside a <Reveal>; staggers its children on arrival. */
function StaggerGrid({ className, children }: { className: string; children: React.ReactNode }) {
  const inView = useContext(RevealContext);
  return <div className={`${className}${inView ? " stagger" : ""}`}>{children}</div>;
}

/**
 * The hero's section wrapper: publishes `--p` without gating anything on scroll.
 *
 * The hero is the one section that must animate on mount — it's the first thing
 * rendered, and waiting for an IntersectionObserver callback to reveal it would
 * show a blank column for a frame or two on a slow device. So it can't use
 * <Reveal>, but it still needs a `--p` writer for the emblem column's drift.
 *
 * It publishes no RevealContext because it has no in-view signal to publish;
 * anything added inside that needs one belongs in a <Reveal> of its own.
 */
function HeroProgress({ children }: { children: React.ReactNode }) {
  const ref = useScrollProgress<HTMLElement>();
  return <section ref={ref}>{children}</section>;
}
