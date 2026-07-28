import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HelpCircle, CalendarDays, ClipboardList, Newspaper, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [stats, setStats] = useState({ questions: 0, daily: 0, mocks: 0, news: 0, users: 0 });
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
    { label: "Questions", value: stats.questions, icon: HelpCircle, color: "text-blue-600 bg-blue-50" },
    { label: "Daily Tests", value: stats.daily, icon: CalendarDays, color: "text-emerald-600 bg-emerald-50" },
    { label: "Mock Exams", value: stats.mocks, icon: ClipboardList, color: "text-purple-600 bg-purple-50" },
    { label: "News", value: stats.news, icon: Newspaper, color: "text-orange-600 bg-orange-50" },
    { label: "Users", value: stats.users, icon: Users, color: "text-rose-600 bg-rose-50" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-2xl border border-border bg-white p-5 soft-shadow">
            <div className={"inline-flex h-9 w-9 items-center justify-center rounded-lg " + c.color}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-800 tabular-nums">{c.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
              {c.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
