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
} from "lucide-react";
import { CountUp } from "@/components/CountUp";

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
      <div className="rise-in">
        <h2 className="text-xl font-black tracking-tight text-slate-900">At a glance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Everything currently live across the platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 stagger">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="group rounded-2xl border border-slate-200 bg-white p-5 soft-shadow lift"
            >
              <div className={"inline-flex h-9 w-9 items-center justify-center rounded-lg " + c.tone}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-3xl font-black tabular-nums text-slate-900">
                {c.value == null ? (
                  <span className="inline-block h-8 w-14 animate-pulse rounded bg-slate-100" />
                ) : (
                  <CountUp end={c.value} />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {c.label}
                <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-900 rise-in">Quick actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 stagger">
          {SHORTCUTS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-600/40 hover:bg-blue-50/40"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{s.label}</span>
                  <span className="block truncate text-xs text-slate-500">{s.desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 rise-in">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <FileStack className="h-[18px] w-[18px]" />
        </span>
        <p className="text-xs leading-relaxed text-slate-500">
          Counts read straight from the database, so they include unpublished and hidden records.
          Open a section to filter or edit individual items.
        </p>
      </div>
    </div>
  );
}
