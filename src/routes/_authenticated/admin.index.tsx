import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  HelpCircle,
  CalendarDays,
  ClipboardList,
  Newspaper,
  Users,
  ArrowRight,
  Home,
  FileStack,
  Info,
  Database,
} from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Panel, PanelGlow, Skeleton } from "@/components/ui/panel";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

type Stats = { questions: number; daily: number; mocks: number; news: number; users: number };

/** Quick links surfaced under the stat cards. */
const SHORTCUTS = [
  { to: "/admin/questions", label: "Add a question", desc: "Grow the question bank", icon: HelpCircle },
  { to: "/admin/mocks", label: "Build a mock exam", desc: "Assemble a full-length test", icon: ClipboardList },
  { to: "/admin/homepage", label: "Edit the homepage", desc: "Hero, stats and sections", icon: Home },
  { to: "/admin/news", label: "Post an article", desc: "Publish to the news feed", icon: Newspaper },
] as const;

function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [q, d, m, n, u] = await Promise.all([
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("daily_tests").select("id", { count: "exact", head: true }),
        supabase.from("mock_exams").select("id", { count: "exact", head: true }),
        supabase.from("news_articles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        questions: q.count ?? 0,
        daily: d.count ?? 0,
        mocks: m.count ?? 0,
        news: n.count ?? 0,
        users: u.count ?? 0,
      });
    })();
  }, []);

  /* The five cards used to be five different hues. They're peers, not a ranking,
     so they now share one tile treatment and are told apart by icon and label. */
  const cards = [
    { label: "Questions", value: stats?.questions, icon: HelpCircle, to: "/admin/questions" },
    { label: "Daily Tests", value: stats?.daily, icon: CalendarDays, to: "/admin/daily" },
    { label: "Mock Exams", value: stats?.mocks, icon: ClipboardList, to: "/admin/mocks" },
    { label: "News", value: stats?.news, icon: Newspaper, to: "/admin/news" },
    { label: "Users", value: stats?.users, icon: Users, to: "/admin/users" },
  ] as const;

  if (stats === null) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-[132px] rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Banner. The soft brand surface carries white copy; the stat cards below
          use the flat #11269D so they read as separate objects on the white page. */}
      <Panel tone="soft" className="ring-grad overflow-hidden rise-in">
        <PanelGlow />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-brand-400/50">
              <Database className="h-3 w-3" /> Live data
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">At a glance</h2>
            <p className="mt-1 max-w-md text-sm text-brand-100">
              Everything currently on the platform, straight from the database.
            </p>
          </div>
          <Link
            to="/admin/questions"
            className="btn-brand group inline-flex items-center gap-2 rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-bold text-white"
          >
            Manage content <ArrowRight className="arrow-slide h-4 w-4" />
          </Link>
        </div>
      </Panel>

      <div className="grid gap-4 stagger sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="group rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel lift"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400 text-white transition-transform duration-300 group-hover:scale-105">
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </div>
              <div className="mt-3.5 text-3xl font-black text-white">
                <AnimatedNumber value={c.value ?? 0} />
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-100">
                {c.label}
                <ArrowRight className="arrow-slide h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="rise-in text-lg font-black tracking-tight text-slate-900">Quick actions</h2>
        <div className="mt-4 grid gap-4 stagger sm:grid-cols-2">
          {SHORTCUTS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-center gap-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-4 nudge hover:border-brand-200/60 hover:bg-brand-500"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-800 text-white transition-transform duration-300 group-hover:scale-105">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{s.label}</span>
                  <span className="block truncate text-xs text-brand-100">{s.desc}</span>
                </span>
                <ArrowRight className="arrow-slide h-4 w-4 shrink-0 text-brand-200 group-hover:text-white" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-brand-400/40 bg-brand-600 p-4 rise-in">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-800 text-brand-100">
          <Info className="h-[18px] w-[18px]" />
        </span>
        <p className="text-xs leading-relaxed text-brand-100">
          Counts read straight from the database, so they include unpublished and hidden records.
          Open a section to filter or edit individual items.
        </p>
      </div>
    </div>
  );
}
