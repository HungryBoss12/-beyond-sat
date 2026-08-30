import { Link } from "@tanstack/react-router";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
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
};

export function VocabDueBanner({ dueCount, deckTitle, deckId, compact }: Props) {
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
        className="tap inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-100 ring-1 ring-orange-400/30"
      >
        {dueCount} due · Study
      </Link>
    );
  }

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3 border-orange-400/30 bg-orange-500/10 p-4">
      <div>
        <div className="font-bold text-white">
          {dueCount} card{dueCount === 1 ? "" : "s"} due
          {deckTitle ? ` in ${deckTitle}` : ""}
        </div>
        <p className="mt-0.5 text-sm text-white/60">Keep your streak — review now.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void togglePush()}
          title={pushOn ? "Disable review reminders" : "Enable browser reminders"}
          className="tap rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
        >
          {pushOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </button>
        <Link
          to={studyTo}
          params={studyParams}
          className="btn-brand tap rounded-lg px-4 py-2 text-sm font-bold"
        >
          Study now
        </Link>
      </div>
    </Panel>
  );
}
