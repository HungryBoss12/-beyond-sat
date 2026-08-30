import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell, BellOff, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel, PanelGlow } from "@/components/ui/panel";
import {
  isPushEnabled,
  maybeNotifyDue,
  requestPushPermission,
  setPushEnabled,
} from "@/lib/vocab/reminders";

type Props = {
  dueCount: number;
  deckTitle?: string;
  deckId?: string;
  compact?: boolean;
  embedded?: boolean;
};

export function VocabDueBanner({ dueCount, deckTitle, deckId, compact, embedded }: Props) {
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    setPushOn(isPushEnabled());
  }, []);

  useEffect(() => {
    if (dueCount > 0) maybeNotifyDue(dueCount, deckTitle);
  }, [dueCount, deckTitle]);

  if (dueCount <= 0) return null;

  const studyTo = deckId ? "/vocab/deck/$deckId" : "/vocab/decks";
  const studyParams = deckId ? { deckId } : undefined;

  async function togglePush() {
    if (pushOn) {
      setPushEnabled(false);
      setPushOn(false);
      return;
    }
    const ok = await requestPushPermission();
    setPushOn(ok);
  }

  if (compact) {
    return (
      <Link
        to={studyTo}
        params={studyParams}
        className="tap inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand-800 px-3 py-1 text-xs font-bold text-white ring-1 ring-brand-400/40 hover:bg-brand-400"
      >
        {dueCount} due · Study
      </Link>
    );
  }

  return (
    <Panel tone={embedded ? "plain" : "brand"} className="relative overflow-hidden p-5">
      {!embedded ? <PanelGlow /> : null}
      <div className="relative flex h-full flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-400 text-white">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white">
                {dueCount} card{dueCount === 1 ? "" : "s"} due
                {deckTitle ? ` in ${deckTitle}` : ""}
              </span>
              <span className="vocab-due-badge px-2 py-0.5 text-[10px] uppercase tracking-wide">
                Review
              </span>
            </div>
            <p className="mt-1 text-sm text-brand-100">Keep your streak — review now.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void togglePush()}
            title={pushOn ? "Disable review reminders" : "Enable browser reminders"}
            className="tap cursor-pointer rounded-lg border border-brand-400/40 p-2 text-brand-100 hover:bg-brand-800 hover:text-white"
          >
            {pushOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <Link
            to={studyTo}
            params={studyParams}
            className="btn-brand tap group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 shadow-lg shadow-brand-900/20 hover:bg-brand-50"
          >
            Study now
            <ArrowRight className="arrow-slide h-4 w-4" />
          </Link>
        </div>
      </div>
    </Panel>
  );
}
