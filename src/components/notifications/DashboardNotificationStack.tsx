import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import {
  dismissNotification,
  fetchDashboardNotifications,
  notificationProgress,
  type UserNotification,
} from "@/lib/notifications/client";

export function DashboardNotificationStack() {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [now, setNow] = useState(Date.now());

  async function refresh() {
    setItems(await fetchDashboardNotifications());
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {items.slice(0, 3).map((n, i) => {
          const progress = notificationProgress(n, now);
          return (
            <motion.div
              key={n.id}
              initial={reduceMotion ? false : { opacity: 0, y: -12, x: -8 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.28, delay: i * 0.05 }}
              className="pointer-events-auto overflow-hidden rounded-xl border border-white/20 bg-white/95 shadow-lg backdrop-blur-sm"
            >
              <div className="flex items-start gap-3 px-3 py-2.5">
                {n.image_url ? (
                  <img src={n.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-brand-800">{n.title}</div>
                  {n.body ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{n.body}</p>
                  ) : null}
                  {n.link_url ? (
                    <a
                      href={n.link_url}
                      className="mt-1 inline-block text-[11px] font-bold text-brand-600 hover:text-brand-800"
                    >
                      {n.link_label ?? "View"} →
                    </a>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => void dismissNotification(n.id).then(refresh)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="h-1 bg-brand-100">
                <motion.div
                  className="h-full bg-brand-500"
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: reduceMotion ? 0 : 1, ease: "linear" }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
