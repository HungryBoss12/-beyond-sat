import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, X } from "lucide-react";
import {
  deleteNotificationFromInbox,
  markNotificationRead,
  notifyNotificationsChanged,
  type UserNotification,
} from "@/lib/notifications/client";
import { useNotificationAnchorOptional } from "./NotificationAnchorContext";

type Props = {
  open: boolean;
  items: UserNotification[];
  onClose: () => void;
  onRefresh: () => void;
  inboxRef?: (el: HTMLDivElement | null) => void;
  landingPulse?: boolean;
};

export function NotificationInbox({ open, items, onClose, onRefresh, inboxRef, landingPulse }: Props) {
  const reduceMotion = useReducedMotion();

  async function handleDelete(id: string) {
    await deleteNotificationFromInbox(id);
    notifyNotificationsChanged();
    onRefresh();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={inboxRef}
          initial={reduceMotion ? false : { opacity: 0, y: -12, x: 24, scale: 0.96 }}
          animate={{
            opacity: 1,
            y: 0,
            x: 0,
            scale: landingPulse && !reduceMotion ? [1, 1.02, 1] : 1,
          }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -10, x: 16, scale: 0.97 }}
          transition={{
            duration: landingPulse ? 0.5 : 0.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="dashboard-notif-inbox absolute right-0 top-full z-50 mt-2 w-[min(92vw,420px)] rounded-3xl"
        >
          <div className="dashboard-notif-inbox__head">
            <div className="text-base font-black text-white">Notifications</div>
            <div className="mt-0.5 text-xs text-brand-100">Saved until you delete them</div>
          </div>
          <div className="max-h-[min(70vh,420px)] overflow-y-auto rounded-b-2xl">
            {items.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-brand-100">No notifications right now.</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={
                    "border-b border-brand-400/20 px-5 py-4 last:border-0 " +
                    (!n.read_at ? "bg-brand-800/50" : "")
                  }
                >
                  <div className="flex items-start gap-3">
                    {n.image_url ? (
                      <img
                        src={n.image_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-brand-400/40"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-white">{n.title}</div>
                      {n.body ? (
                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-brand-100">{n.body}</p>
                      ) : null}
                      <div className="mt-1.5 text-[10px] text-brand-200">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {n.link_url ? (
                          <a
                            href={n.link_url}
                            onClick={() => {
                              void markNotificationRead(n.id).then(onRefresh);
                              onClose();
                            }}
                            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
                          >
                            {n.link_label ?? "Open"}
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleDelete(n.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-400/40 px-3 py-1.5 text-xs font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete notification"
                      onClick={() => void handleDelete(n.id)}
                      className="dashboard-notif-card__close shrink-0"
                    >
                      <X className="h-4 w-4" />
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
