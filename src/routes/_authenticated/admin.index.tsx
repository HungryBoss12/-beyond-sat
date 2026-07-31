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

  const cards = [
    { label: "Questions", value: stats?.questions, icon: HelpCircle, to: "/admin/questions", tone: "text-blue-600 bg-blue-50" },
    { label: "Daily Tests", value: stats?.daily, icon: CalendarDays, to: "/admin/daily", tone: "text-emerald-600 bg-emerald-50" },
    { label: "Mock Exams", value: stats?.mocks, icon: ClipboardList, to: "/admin/mocks", tone: "text-purple-600 bg-purple-50" },
    { label: "News", value: stats?.news, icon: Newspaper, to: "/admin/news", tone: "text-orange-600 bg-orange-50" },
    { label: "Users", value: stats?.users, icon: Users, to: "/admin/users", tone: "text-rose-600 bg-rose-50" },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Banner. Soft gradient rather than a saturated slab, so the stat cards
          below it stay the brightest thing on the page. */}
      <Panel tone="soft" className="ring-grad overflow-hidden rise-in">
        <PanelGlow />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-600/10">
              <Database className="h-3 w-3" /> Live data
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">At a glance</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Everything currently on the platform, straight from the database.
            </p>
          </div>
          <Link
            to="/admin/questions"
            className="btn-brand group inline-flex items-center gap-2 rounded-xl bg-grad-brand px-4 py-2.5 text-sm font-bold text-white"
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
              className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel lift"
            >
              <div
                className={
                  "tile-invert inline-flex h-10 w-10 items-center justify-center rounded-xl " + c.tone
                }
              >
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </div>
              <div className="mt-3.5 text-3xl font-black text-slate-900">
                {c.value == null ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <AnimatedNumber value={c.value} />
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 nudge hover:border-blue-600/40 hover:bg-blue-50/50"
              >
                <span className="tile-invert grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{s.label}</span>
                  <span className="block truncate text-xs text-slate-500">{s.desc}</span>
                </span>
                <ArrowRight className="arrow-slide h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-600" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 rise-in">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <Info className="h-[18px] w-[18px]" />
        </span>
        <p className="text-xs leading-relaxed text-slate-500">
          Counts read straight from the database, so they include unpublished and hidden records.
          Open a section to filter or edit individual items.
        </p>
      </div>
    </div>
  );
}
