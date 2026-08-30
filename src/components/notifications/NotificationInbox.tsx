import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { X } from "lucide-react";
import {
  dismissNotification,
  markNotificationRead,
  type UserNotification,
} from "@/lib/notifications/client";

type Props = {
  open: boolean;
  items: UserNotification[];
  onClose: () => void;
  onRefresh: () => void;
};

export function NotificationInbox({ open, items, onClose, onRefresh }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-float"
        >
          <div className="border-b border-brand-400/30 bg-brand-600 px-4 py-3">
            <div className="text-sm font-black text-white">Notifications</div>
            <div className="text-xs text-brand-100">Dashboard updates and homework</div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications right now.</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={
                    "border-b border-brand-50 px-4 py-3 last:border-0 " +
                    (!n.read_at ? "bg-brand-50/60" : "")
                  }
                >
                  <div className="flex items-start gap-3">
                    {n.image_url ? (
                      <img
                        src={n.image_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-brand-100"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-brand-900">{n.title}</div>
                      {n.body ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.body}</p>
                      ) : null}
                      <div className="mt-1 text-[10px] text-slate-400">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {n.link_url ? (
                          <a
                            href={n.link_url}
                            onClick={() => {
                              void markNotificationRead(n.id).then(onRefresh);
                              onClose();
                            }}
                            className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-700"
                          >
                            {n.link_label ?? "Open"}
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void dismissNotification(n.id).then(onRefresh)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={() => void dismissNotification(n.id).then(onRefresh)}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
