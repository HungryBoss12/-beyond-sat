import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchDashboardNotifications,
  hideNotificationOverlay,
  notifyNotificationLanded,
  notifyNotificationsChanged,
  overlayExpired,
  overlayProgress,
  type UserNotification,
} from "@/lib/notifications/client";
import { useNotificationAnchorOptional } from "./NotificationAnchorContext";

const SEEN_KEY = "beyond-sat:dashboard-notif-seen";
const SLIDE_EASE = [0.16, 1, 0.3, 1] as const;
const MAX_STACK = 5;
const STACK_OFFSET_Y = 12;
const STACK_OFFSET_X = 8;

type TransitionState = {
  notification: UserNotification;
  from: DOMRect;
  progress: number;
};

function readSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  const seen = readSeenIds();
  seen.add(id);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

const NOTIF_RADIUS = 24;

function TransitionToInbox({
  transition,
  onDone,
}: {
  transition: TransitionState;
  onDone: () => void;
}) {
  const anchor = useNotificationAnchorOptional();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<"body" | "title" | "fly">("body");
  const [target, setTarget] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      onDone();
      return;
    }
    const bellEl = anchor?.bellRef.current;
    if (!bellEl) {
      const t = window.setTimeout(onDone, 120);
      return () => window.clearTimeout(t);
    }
    const bell = bellEl.getBoundingClientRect();
    const width = Math.min(window.innerWidth * 0.92, 420);
    const left = Math.max(8, bell.right - width);
    setTarget(new DOMRect(left, bell.bottom + 8, width, 76));

    const t1 = window.setTimeout(() => setStage("title"), 280);
    const t2 = window.setTimeout(() => setStage("fly"), 520);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reduceMotion, anchor, onDone]);

  if (reduceMotion || !target) return null;

  const flyTop = target.top;
  const flyLeft = target.left;
  const flyWidth = target.width;
  const flyHeight = Math.min(target.height, 88);

  const bodyOpacity = stage === "body" ? 1 : 0;
  const bodyHeight = stage === "body" ? "auto" : 0;
  const titleScale = stage === "fly" ? 0.92 : 1;
  const shellHeight =
    stage === "body" ? transition.from.height : stage === "title" ? transition.from.height * 0.42 : flyHeight;

  return createPortal(
    <motion.div
      className="dashboard-notif-card pointer-events-none fixed z-[120]"
      style={{
        top: transition.from.top,
        left: transition.from.left,
        width: transition.from.width,
        height: transition.from.height,
        borderRadius: NOTIF_RADIUS,
      }}
      animate={
        stage === "fly"
          ? {
              top: flyTop,
              left: flyLeft,
              width: flyWidth,
              height: flyHeight,
              borderRadius: NOTIF_RADIUS,
              opacity: 0.92,
            }
          : {
              height: shellHeight,
              borderRadius: NOTIF_RADIUS,
            }
      }
      transition={{ duration: stage === "fly" ? 0.65 : 0.32, ease: SLIDE_EASE }}
      onAnimationComplete={() => {
        if (stage === "fly") onDone();
      }}
    >
      <div className="flex h-[calc(100%-6px)] flex-col overflow-hidden">
        <div className="flex items-start gap-4 px-6 py-4">
          <motion.div
            className="min-w-0 flex-1"
            animate={{ scale: titleScale, opacity: stage === "fly" ? 0.85 : 1 }}
            transition={{ duration: 0.28, ease: SLIDE_EASE }}
          >
            <div className="dashboard-notif-card__title truncate">{transition.notification.title}</div>
            <motion.div
              animate={{ opacity: bodyOpacity, height: bodyHeight }}
              transition={{ duration: 0.28, ease: SLIDE_EASE }}
              className="overflow-hidden"
            >
              {transition.notification.body ? (
                <p className="dashboard-notif-card__body line-clamp-2">{transition.notification.body}</p>
              ) : null}
            </motion.div>
          </motion.div>
          <motion.div animate={{ opacity: stage === "body" ? 1 : 0 }} transition={{ duration: 0.2 }}>
            <X className="h-5 w-5 text-brand-100" />
          </motion.div>
        </div>
      </div>
      <div className="dashboard-notif-card__track">
        <div className="dashboard-notif-card__bar" style={{ width: `${transition.progress * 100}%` }} />
      </div>
    </motion.div>,
    document.body,
  );
}

type NotificationCardProps = {
  n: UserNotification;
  index: number;
  stackSize: number;
  progress: number;
  firstWitness: boolean;
  reduceMotion: boolean | null;
  onClose: (id: string) => void;
  cardRef: (el: HTMLDivElement | null) => void;
};

function NotificationCard({
  n,
  index,
  stackSize,
  progress,
  firstWitness,
  reduceMotion,
  onClose,
  cardRef,
}: NotificationCardProps) {
  const isFront = index === 0;
  const depth = index;

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={
        reduceMotion ? false : { opacity: 0, x: "105%", scale: firstWitness ? 0.94 : 0.97 }
      }
      animate={{
        opacity: isFront ? 1 : Math.max(0.55, 0.9 - depth * 0.08),
        x: depth * STACK_OFFSET_X,
        y: depth * STACK_OFFSET_Y,
        scale: 1 - depth * 0.03,
      }}
      exit={
        reduceMotion
          ? undefined
          : { opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.35, ease: SLIDE_EASE } }
      }
      transition={{
        layout: { duration: 0.5, ease: SLIDE_EASE },
        opacity: { duration: firstWitness ? 0.65 : 0.45, ease: SLIDE_EASE },
        x: { duration: firstWitness ? 0.75 : 0.58, ease: SLIDE_EASE, delay: index * 0.08 },
        y: { duration: 0.5, ease: SLIDE_EASE },
        scale: { duration: 0.5, ease: SLIDE_EASE },
      }}
      style={{
        zIndex: stackSize - index,
        position: index === 0 ? "relative" : "absolute",
        top: 0,
        right: 0,
        width: "100%",
        transformOrigin: "center right",
        pointerEvents: isFront ? "auto" : "none",
        borderRadius: NOTIF_RADIUS,
      }}
      className="dashboard-notif-card rounded-3xl"
    >
      <div className="flex items-start gap-5 px-7 py-6">
        {n.image_url ? (
          <img src={n.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="dashboard-notif-card__title">{n.title}</div>
          {n.body ? <p className="dashboard-notif-card__body line-clamp-4">{n.body}</p> : null}
          {n.link_url ? (
            <a
              href={n.link_url}
              className="mt-3 inline-block text-sm font-bold text-white underline decoration-brand-200/70 underline-offset-2 hover:decoration-white"
            >
              {n.link_label ?? "View"} →
            </a>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Move to notifications"
          onClick={(e) => {
            e.stopPropagation();
            onClose(n.id);
          }}
          className="dashboard-notif-card__close"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
      </div>
      <div className="dashboard-notif-card__track">
        <motion.div
          className="dashboard-notif-card__bar"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: reduceMotion ? 0 : 1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

export function DashboardNotificationStack() {
  const reduceMotion = useReducedMotion();
  const anchor = useNotificationAnchorOptional();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [now, setNow] = useState(Date.now());
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [heroIds, setHeroIds] = useState<Set<string>>(() => new Set());
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const expiringRef = useRef(new Set<string>());
  const flyingRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    setItems(await fetchDashboardNotifications());
  }, []);

  useEffect(() => {
    void refresh();
    const refreshId = window.setInterval(() => void refresh(), 60_000);
    const tickId = window.setInterval(() => setNow(Date.now()), 200);
    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(tickId);
    };
  }, [refresh]);

  useEffect(() => {
    const seen = readSeenIds();
    const newcomers = new Set<string>();
    for (const n of items) {
      if (!seen.has(n.id)) {
        newcomers.add(n.id);
        markSeen(n.id);
      }
    }
    if (newcomers.size > 0) {
      setHeroIds((prev) => new Set([...prev, ...newcomers]));
    }
  }, [items]);

  const startTransitionToInbox = useCallback(
    (id: string) => {
      if (flyingRef.current.has(id) || transition) return;
      const notification = items.find((n) => n.id === id);
      if (!notification) return;

      flyingRef.current.add(id);
      const el = cardRefs.current.get(id);
      const progress = overlayProgress(notification, now);

      if (!el || reduceMotion) {
        void hideNotificationOverlay(id)
          .then(() => {
            setItems((prev) => prev.filter((n) => n.id !== id));
            notifyNotificationsChanged();
            anchor?.pulseBell();
            anchor?.flashInbox();
            notifyNotificationLanded();
          })
          .catch((e) => {
            flyingRef.current.delete(id);
            toast.error(e instanceof Error ? e.message : "Could not move notification");
          });
        return;
      }

      setTransition({ notification, from: el.getBoundingClientRect(), progress });
    },
    [items, transition, reduceMotion, anchor, now],
  );

  useEffect(() => {
    if (transition) return;
    for (const n of items) {
      if (expiringRef.current.has(n.id) || flyingRef.current.has(n.id)) continue;
      if (!overlayExpired(n, now)) continue;
      expiringRef.current.add(n.id);
      startTransitionToInbox(n.id);
      break;
    }
  }, [now, items, transition, startTransitionToInbox]);

  function handleClose(id: string) {
    setDismissError(null);
    startTransitionToInbox(id);
  }

  const handleTransitionDone = useCallback(() => {
    setTransition((current) => {
      if (!current) return null;
      const id = current.notification.id;
      void hideNotificationOverlay(id)
        .then(() => {
          setItems((prev) => prev.filter((n) => n.id !== id));
          notifyNotificationsChanged();
          anchor?.pulseBell();
          anchor?.flashInbox();
          notifyNotificationLanded();
        })
        .catch((e) => {
          flyingRef.current.delete(id);
          expiringRef.current.delete(id);
          const message = e instanceof Error ? e.message : "Could not move notification";
          setDismissError(message);
          toast.error(message);
        })
        .finally(() => {
          flyingRef.current.delete(id);
        });
      return null;
    });
  }, [anchor]);

  const visible = transition ? items.filter((n) => n.id !== transition.notification.id) : items;
  const stack = visible.slice(0, MAX_STACK);

  if (!stack.length && !transition) return null;

  const stackPad = stack.length > 1 ? (stack.length - 1) * STACK_OFFSET_Y : 0;

  const content = (
    <>
      <div className="dashboard-notif-stack">
        {dismissError ? (
          <p className="dashboard-notif-card pointer-events-auto mb-3 px-4 py-2 text-xs text-red-100">
            {dismissError}
          </p>
        ) : null}

        <div className="relative" style={{ paddingBottom: stackPad }}>
          <AnimatePresence initial={false} mode="popLayout">
            {stack.map((n, i) => {
              const progress = overlayProgress(n, now);
              const firstWitness = heroIds.has(n.id);

              return (
                <NotificationCard
                  key={n.id}
                  n={n}
                  index={i}
                  stackSize={stack.length}
                  progress={progress}
                  firstWitness={firstWitness}
                  reduceMotion={reduceMotion}
                  onClose={handleClose}
                  cardRef={(el) => {
                    if (el) cardRefs.current.set(n.id, el);
                    else cardRefs.current.delete(n.id);
                  }}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {transition ? (
        <TransitionToInbox transition={transition} onDone={handleTransitionDone} />
      ) : null}
    </>
  );

  return createPortal(content, document.body);
}
