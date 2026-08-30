import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, BellRing } from "lucide-react";
import {
  fetchMyNotifications,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  NOTIFICATION_LANDED_EVENT,
  type UserNotification,
} from "@/lib/notifications/client";
import { NotificationInbox } from "./NotificationInbox";
import { useNotificationAnchorOptional } from "./NotificationAnchorContext";

type Props = {
  onNotificationsChange?: (items: UserNotification[]) => void;
};

export function NotificationBell({ onNotificationsChange }: Props) {
  const reduceMotion = useReducedMotion();
  const anchor = useNotificationAnchorOptional();
  const [open, setOpen] = useState(false);
  const [landingPulse, setLandingPulse] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashTimerRef = useRef<number | null>(null);

  const setRootRef = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (anchor) anchor.bellRef.current = el;
  };

  useEffect(() => {
    if (!anchor) return;
    anchor.registerPulse(() => {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 2400);
    });
    anchor.registerFlashInbox(() => {
      setOpen(true);
      setLandingPulse(true);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => {
        setLandingPulse(false);
        setOpen(false);
      }, 1400);
    });
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, [anchor]);

  const unread = items.filter((n) => !n.read_at).length;

  async function refresh() {
    const next = await fetchMyNotifications();
    if (next.length > prevCount.current && prevCount.current > 0) {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 2400);
    }
    prevCount.current = next.length;
    setItems(next);
    onNotificationsChange?.(next);
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    function onChanged() {
      void refresh();
    }
    function onLanded() {
      void refresh();
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    window.addEventListener(NOTIFICATION_LANDED_EVENT, onLanded);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener(NOTIFICATION_LANDED_EVENT, onLanded);
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const Icon = unread > 0 ? BellRing : Bell;

  return (
    <div ref={setRootRef} data-notification-bell className="relative">
      <AnimatePresence>
        {pulse && !reduceMotion ? (
          <motion.span
            key="ring"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0.6, 0.2, 0], scale: [1, 1.8, 2.2] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70"
          />
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread) {
            void Promise.all(
              items.filter((n) => !n.read_at).map((n) => markNotificationRead(n.id)),
            ).then(refresh);
          }
        }}
        whileHover={reduceMotion ? undefined : { scale: 1.05 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        className="relative inline-flex items-center justify-center rounded-full border border-brand-400/50 bg-brand-800 p-2 text-white transition-colors hover:bg-brand-700"
      >
        <Icon className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-brand-700">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </motion.button>

      <NotificationInbox
        open={open}
        items={items}
        landingPulse={landingPulse}
        inboxRef={anchor ? anchor.registerInboxRef : undefined}
        onClose={() => setOpen(false)}
        onRefresh={() => void refresh()}
      />
    </div>
  );
}
