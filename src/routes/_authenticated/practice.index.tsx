import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookText, Calculator, ClipboardList, CalendarClock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PageHead, Panel } from "@/components/ui/panel";
import { RevealLink } from "@/components/ui/reveal-card";
import { HeadSkeleton, CardGridSkeleton } from "@/components/ui/skeletons";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/practice/")({
  component: PracticeLanding,
});

function PracticeLanding() {
  const [loading, setLoading] = useState(true);
  const [rwCount, setRwCount] = useState<number | null>(null);
  const [mathCount, setMathCount] = useState<number | null>(null);
  const [mockCount, setMockCount] = useState<number | null>(null);
  const [dailyExists, setDailyExists] = useState<boolean>(false);
  const [dailyDone, setDailyDone] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    (async () => {
      try {
        /* Old approach used `{ count: "exact", head: true }`, which relies on the
           PostgREST Content-Range response header being readable by the browser.
           Some Supabase clients / proxies don't expose it, so the count silently
           lands as null and the page renders "0 questions available". Fetching
           `select("id")` rows and counting on the client side doesn't have that
           problem — and for a question bank under a few thousand rows it adds no
           meaningful latency. The `skill` query in `practice.$section.tsx` already
           uses this pattern successfully. */
        const [
          { data: rwRows },
          { data: mRows },
          { data: mockRows },
          { data: dt },
          { data: sess },
        ] = await Promise.all([
          supabase.from("questions").select("id").eq("section", "reading_writing"),
          supabase.from("questions").select("id").eq("section", "math"),
          supabase.from("mock_exams").select("id").eq("published", true),
          supabase.from("daily_tests").select("id").eq("date", today).maybeSingle(),
          /* `getSession()` reads the token from localStorage — it never makes a
               network call. `getUser()` hits the auth API, so putting it inside
               Promise.all blocked the counts from rendering until the auth server
               responded. We only need the user id to check whether today's daily
               is already completed; that's a single cheap request after the counts
               are already on screen. */
          supabase.auth.getSession(),
        ]);

        setRwCount((rwRows ?? []).length);
        setMathCount((mRows ?? []).length);
        setMockCount((mockRows ?? []).length);
        setDailyExists(!!dt);

        /* `getSession()` resolves to `{ data: { session }, error }`, so the user
           hangs off `session`, not off `data` directly. Reading `sess.user` was
           always undefined, which silently skipped the check below — today's
           daily test kept offering "Start" after it had been completed. */
        const uid = sess?.session?.user?.id;
        if (uid) {
          const { data: sp } = await supabase
            .from("student_profiles")
            .select("last_daily_completed_date")
            .eq("user_id", uid)
            .maybeSingle();
          setDailyDone(sp?.last_daily_completed_date === today);
        }
      } catch (e: unknown) {
        setErr(errorMessage(e, "Could not load practice data."));
      } finally {
        setLoading(false);
      }
    })();
  }, [today]);

  if (err) {
    return (
      <div className="space-y-6">
        <PageHead title="Practice" subtitle="Choose a section or take a full mock exam." />
        <div className="rounded-2xl border border-dashed border-brand-300/50 bg-brand-800/50 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-white">Could not load practice data</p>
          <p className="mt-1 text-xs text-brand-100">{err}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-brand mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  /* Counts used to appear as em-dashes while the queries ran, which reads as
     "no questions" rather than "still loading". Mirror the real layout instead:
     two section cards, then the two smaller action cards. */
  if (loading) {
    return (
      <div className="space-y-6">
        <HeadSkeleton />
        <CardGridSkeleton count={2} height={220} />
        <CardGridSkeleton count={2} height={170} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Practice"
        subtitle="Choose a section, jump into today's daily test, or take a full mock exam."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SectionCard
          section="reading_writing"
          icon={<BookText className="h-6 w-6" />}
          title="Reading & Writing"
          count={rwCount}
        />
        <SectionCard
          section="math"
          icon={<Calculator className="h-6 w-6" />}
          title="Math"
          count={mathCount}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-400 text-white">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-black text-white">Today's daily test</div>
              <div className="text-xs text-brand-100">
                {dailyExists
                  ? dailyDone
                    ? "You've completed today's test. Nice."
                    : "Short mixed set. Feeds your streak."
                  : "No daily test posted for today yet."}
              </div>
            </div>
          </div>
          <Link
            to="/practice/daily"
            aria-disabled={!dailyExists || dailyDone}
            className={
              "btn-brand mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2.5 text-sm font-bold text-white " +
              (!dailyExists || dailyDone ? "pointer-events-none opacity-40" : "")
            }
          >
            {dailyDone ? "Completed" : "Start"} <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-800 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-black text-white">Full mock exams</div>
              <div className="text-xs text-brand-100">
                {mockCount ?? 0} exam{mockCount === 1 ? "" : "s"} available · two-module adaptive
              </div>
            </div>
          </div>
          <Link
            to="/practice/mock"
            aria-disabled={!mockCount}
            className={
              "btn-ghost mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-300/60 bg-brand-800 px-4 py-2.5 text-sm font-bold text-white " +
              (!mockCount ? "pointer-events-none opacity-40" : "")
            }
          >
            Browse mocks <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      </div>
    </div>
  );
}

/**
 * `section` is the route param, not a full path: the generated route tree only
 * exposes `/practice/$section`, so hand-writing a union of concrete paths
 * ("/practice/math") doesn't typecheck against it.
 */
function SectionCard({
  section,
  icon,
  title,
  count,
}: {
  section: "reading_writing" | "math";
  icon: React.ReactNode;
  title: string;
  count: number | null;
}) {
  /* RevealLink rather than Link: this card is cursor-lit like every <Panel>, but
     it's a link, so the glow has to live on the anchor itself. */
  return (
    <RevealLink
      to="/practice/$section"
      params={{ section }}
      className="group lift relative overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 p-6 text-white shadow-panel"
    >
      {/* Decorative wash, lighter than the card so it reads as a highlight. */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-400/40 blur-2xl" />
      <div className="relative">
        <div className="tile-invert grid h-12 w-12 place-items-center rounded-xl bg-brand-800 text-white">
          {icon}
        </div>
        <h2 className="mt-4 text-2xl font-black text-white">{title}</h2>
        <div className="mt-1 text-sm text-brand-100">
          <span className="font-black tabular-nums text-white">{count ?? 0}</span> questions
          available
        </div>
        <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-white">
          Practice this section <ArrowRight className="arrow-slide h-4 w-4" />
        </div>
      </div>
    </RevealLink>
  );
}
