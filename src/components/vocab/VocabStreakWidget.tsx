import { format, subDays } from "date-fns";
import { Check, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchVocabActivityLast7 } from "@/lib/vocab/client";
import { Panel, PanelHead } from "@/components/ui/panel";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function VocabStreakWidget({ compact }: { compact?: boolean }) {
  const [streak, setStreak] = useState(0);
  const [activeDays, setActiveDays] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;

      const [{ data: sp }, days] = await Promise.all([
        supabase
          .from("student_profiles")
          .select("current_streak")
          .eq("user_id", uid)
          .maybeSingle(),
        fetchVocabActivityLast7(),
      ]);

      setStreak(sp?.current_streak ?? 0);
      setActiveDays(days);
    })();
  }, []);

  const weekLabels = buildWeekLabels();

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Flame className="h-4 w-4 text-orange-400" />
        <span className="font-bold tabular-nums text-white">{streak}</span>
        <span className="text-white/60">day streak</span>
      </div>
    );
  }

  return (
    <Panel className="p-5">
      <PanelHead label="Vocab streak" icon={Flame} tone="warm" />
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-4xl font-black tabular-nums text-white">{streak}</div>
          <div className="text-sm text-white/60">days in a row</div>
        </div>
        <div className="flex gap-1.5">
          {weekLabels.map((label, i) => {
            const active = activeDays[i] !== "";
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${
                    active
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/30"
                  }`}
                >
                  {active ? <Check className="h-4 w-4" /> : null}
                </div>
                <span className="text-[10px] text-white/50">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function buildWeekLabels(): string[] {
  const today = new Date();
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(today, i);
    labels.push(format(d, "EEE").slice(0, 3));
  }
  return labels.length === 7 ? labels : DAYS;
}
