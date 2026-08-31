import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type AdminAnim =
  | "overview"
  | "homepage"
  | "questions"
  | "vocab"
  | "import"
  | "tests"
  | "daily"
  | "mocks"
  | "examdates"
  | "news"
  | "classes"
  | "notifications"
  | "users"
  | "settings";

const EASE = [0.22, 1, 0.36, 1] as const;
const SNAP = { duration: 0.25, ease: EASE };

type Props = {
  anim: AdminAnim;
  active?: boolean;
  className?: string;
  hovered?: boolean;
};

/**
 * Admin sidebar glyph with Motion micro-interactions.
 * Prefer `hovered` from the parent row so enter/leave matches the whole link.
 */
export function AdminNavIcon({ anim, className, hovered: hoveredProp }: Props) {
  const reduce = useReducedMotion();
  const [localHover, setLocalHover] = useState(false);
  const hovered = hoveredProp ?? localHover;
  const h = reduce ? false : hovered;

  return (
    <span
      className={cn("grid h-[18px] w-[18px] shrink-0 place-items-center", className)}
      onPointerEnter={hoveredProp === undefined ? () => setLocalHover(true) : undefined}
      onPointerLeave={hoveredProp === undefined ? () => setLocalHover(false) : undefined}
      aria-hidden
    >
      {anim === "overview" && <OverviewIcon hovered={h} />}
      {anim === "homepage" && <HomepageIcon hovered={h} />}
      {anim === "questions" && <QuestionsIcon hovered={h} />}
      {anim === "vocab" && <VocabIcon hovered={h} />}
      {anim === "import" && <ImportIcon hovered={h} />}
      {anim === "tests" && <TestsIcon hovered={h} />}
      {anim === "daily" && <DailyIcon hovered={h} />}
      {anim === "mocks" && <MocksIcon hovered={h} />}
      {anim === "examdates" && <ExamDatesIcon hovered={h} />}
      {anim === "news" && <NewsIcon hovered={h} />}
      {anim === "classes" && <ClassesIcon hovered={h} />}
      {anim === "notifications" && <NotificationsIcon hovered={h} />}
      {anim === "users" && <UsersIcon hovered={h} />}
      {anim === "settings" && <SettingsIcon hovered={h} />}
    </span>
  );
}

const svgProps = {
  viewBox: "0 0 24 24",
  className: "h-[18px] w-[18px] overflow-visible",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function OverviewIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{ scale: hovered ? 1.05 : 1 }}
      transition={SNAP}
      style={{ willChange: "transform" }}
    >
      <motion.rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="1.5"
        fill="currentColor"
        stroke="none"
        animate={{ x: 0, y: 0 }}
      />
      <motion.rect
        x="13"
        y="3"
        width="8"
        height="8"
        rx="1.5"
        fill="currentColor"
        stroke="none"
        animate={{ x: hovered ? 1.5 : 0, y: hovered ? -1.5 : 0 }}
        transition={SNAP}
        style={{ willChange: "transform" }}
      />
      <motion.rect
        x="3"
        y="13"
        width="8"
        height="8"
        rx="1.5"
        fill="currentColor"
        stroke="none"
        animate={{ x: hovered ? -1.5 : 0, y: hovered ? 1.5 : 0 }}
        transition={SNAP}
        style={{ willChange: "transform" }}
      />
      <motion.rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />
    </motion.svg>
  );
}

function HomepageIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{ y: hovered ? -2 : 0 }}
      transition={
        hovered
          ? { type: "spring", stiffness: 400, damping: 10 }
          : { type: "spring", stiffness: 400, damping: 18 }
      }
      style={{ willChange: "transform" }}
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-6h4v6" />
    </motion.svg>
  );
}

function QuestionsIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{ rotate: hovered ? 12 : 0 }}
      transition={SNAP}
      style={{ willChange: "transform", transformOrigin: "center" }}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 0 1 5.1.8c0 1.7-2.5 2.2-2.5 3.8" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </motion.svg>
  );
}

/** Flashcard stack + SRS loop — matches the vocab hub glyph family. */
function VocabIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg {...svgProps}>
      {/* Back cards in the deck */}
      <motion.rect
        x="5.5"
        y="6.5"
        width="10"
        height="12"
        rx="1.4"
        strokeOpacity={0.35}
        animate={{
          x: hovered ? 6.2 : 5.5,
          y: hovered ? 5.8 : 6.5,
          rotate: hovered ? 6 : 0,
        }}
        transition={SNAP}
        style={{ willChange: "transform", transformOrigin: "10px 12px" }}
      />
      <motion.rect
        x="4.5"
        y="7.5"
        width="10"
        height="12"
        rx="1.4"
        strokeOpacity={0.55}
        animate={{
          x: hovered ? 4.8 : 4.5,
          y: hovered ? 6.9 : 7.5,
          rotate: hovered ? -4 : 0,
        }}
        transition={SNAP}
        style={{ willChange: "transform", transformOrigin: "9px 13px" }}
      />
      {/* Front card */}
      <motion.g
        animate={{ y: hovered ? -2.5 : 0, rotate: hovered ? -2 : 0 }}
        transition={hovered ? { type: "spring", stiffness: 420, damping: 16 } : SNAP}
        style={{ willChange: "transform", transformOrigin: "12px 14px" }}
      >
        <rect x="3.5" y="8" width="10" height="12" rx="1.4" />
        <motion.line
          x1="5.8"
          y1="11.2"
          x2="11.2"
          y2="11.2"
          animate={{ scaleX: hovered ? 0.72 : 1 }}
          transition={SNAP}
          style={{ willChange: "transform", transformOrigin: "5.8px 11.2px" }}
        />
        <motion.rect
          x="5.8"
          y="13"
          width="4.8"
          height="1.3"
          rx="0.35"
          fill="currentColor"
          stroke="none"
          animate={{
            scaleX: hovered ? 1.18 : 1,
            opacity: hovered ? 1 : 0.85,
          }}
          transition={SNAP}
          style={{ willChange: "transform", transformOrigin: "5.8px 13.6px" }}
        />
        <line x1="5.8" y1="15.6" x2="9.2" y2="15.6" strokeOpacity={0.45} />
      </motion.g>
      {/* SRS interval loop */}
      <motion.g
        animate={{ rotate: hovered ? -95 : 0, scale: hovered ? 1.08 : 1 }}
        transition={SNAP}
        style={{ willChange: "transform", transformOrigin: "17px 17px" }}
      >
        <path d="M16.2 16.8a3.2 3.2 0 1 0-2.5-3.1" strokeWidth={1.65} />
        <path d="M13.4 13.2l-.2 2 1.8-.6" strokeWidth={1.5} />
      </motion.g>
    </svg>
  );
}

function ImportIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg {...svgProps}>
      <path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
      <motion.g
        animate={
          hovered
            ? {
                y: [-0, -3, -8],
                opacity: [1, 0.55, 0],
              }
            : { y: 0, opacity: 1 }
        }
        transition={
          hovered
            ? { duration: 0.45, times: [0, 0.45, 1], ease: EASE }
            : { duration: 0.22, ease: EASE }
        }
        style={{ willChange: "transform, opacity" }}
      >
        <path d="M12 15V5" />
        <path d="M8 9l4-4 4 4" />
      </motion.g>
      {hovered && (
        <motion.g
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.28, ease: EASE }}
          style={{ willChange: "transform, opacity" }}
        >
          <path d="M12 15V5" />
          <path d="M8 9l4-4 4 4" />
        </motion.g>
      )}
    </svg>
  );
}

function TestsIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg {...svgProps}>
      <motion.rect
        x="6"
        y="4"
        width="11"
        height="14"
        rx="1.5"
        animate={{ x: hovered ? -2 : 0, y: hovered ? -2 : 0 }}
        transition={SNAP}
        style={{ willChange: "transform" }}
      />
      <motion.rect
        x="8"
        y="6"
        width="11"
        height="14"
        rx="1.5"
        fill="currentColor"
        fillOpacity={0.12}
        animate={{ x: hovered ? 2 : 0, y: hovered ? 2 : 0 }}
        transition={SNAP}
        style={{ willChange: "transform" }}
      />
    </svg>
  );
}

function DailyIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.span
      className="grid place-items-center"
      style={{ perspective: 120, willChange: "transform" }}
    >
      <motion.svg
        {...svgProps}
        animate={{
          rotateX: hovered ? 20 : 0,
          opacity: hovered ? [1, 0.75, 1] : 1,
        }}
        transition={hovered ? { duration: 0.3, ease: EASE } : SNAP}
        style={{ willChange: "transform", transformStyle: "preserve-3d" }}
      >
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17" />
        <path d="M8 3.5v3.5M16 3.5v3.5" />
        <path d="M8.5 14h2M13.5 14h2M8.5 17h2" />
      </motion.svg>
    </motion.span>
  );
}

function MocksIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg {...svgProps}>
      <motion.g
        animate={{ scale: hovered ? 1.02 : 1 }}
        transition={SNAP}
        style={{ willChange: "transform", transformOrigin: "12px 14px" }}
      >
        <rect x="6" y="5" width="12" height="16" rx="1.5" />
        <path d="M9 11.5h6M9 15h4" />
      </motion.g>
      <motion.g
        animate={{ y: hovered ? 1 : 0 }}
        transition={SNAP}
        style={{ willChange: "transform" }}
      >
        <path d="M9 5V3.8a1.2 1.2 0 0 1 1.2-1.2h3.6A1.2 1.2 0 0 1 15 3.8V5" />
        <rect
          x="10.2"
          y="2.6"
          width="3.6"
          height="2.2"
          rx="0.6"
          fill="currentColor"
          stroke="none"
        />
      </motion.g>
    </svg>
  );
}

function ExamDatesIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{
        rotate: hovered ? 15 : 0,
        filter: hovered
          ? "drop-shadow(0 0 3px rgba(255,255,255,0.45))"
          : "drop-shadow(0 0 0 transparent)",
      }}
      transition={SNAP}
      style={{ willChange: "transform, filter", transformOrigin: "center" }}
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3.5v3.5M16 3.5v3.5" />
      <circle cx="15.2" cy="15.2" r="3.4" />
      <path d="M15.2 13.6v1.8l1.2.7" />
    </motion.svg>
  );
}

function NewsIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{ scaleX: hovered ? 1.08 : 1, rotate: hovered ? -4 : 0 }}
      transition={SNAP}
      style={{ willChange: "transform", transformOrigin: "center" }}
    >
      <path d="M5 5h11a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V5Z" />
      <path d="M18 7h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1" />
      <path d="M8 10h7M8 13.5h5" />
    </motion.svg>
  );
}

function ClassesIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{ rotate: hovered ? -10 : 0, y: hovered ? -2 : 0 }}
      transition={SNAP}
      style={{ willChange: "transform", transformOrigin: "center" }}
    >
      <path d="M3 9.5 12 5l9 4.5-9 4.5L3 9.5Z" />
      <path d="M7 12.2v4.3c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.3" />
      <path d="M21 9.5v6.2" />
    </motion.svg>
  );
}

function NotificationsIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{
        rotate: hovered ? [0, -14, 14, -10, 8, 0] : 0,
        scale: hovered ? 1.08 : 1,
      }}
      transition={hovered ? { duration: 0.55, ease: EASE } : SNAP}
      style={{ willChange: "transform", transformOrigin: "12px 6px" }}
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <motion.circle
        cx="17.5"
        cy="5"
        r="2.2"
        fill="currentColor"
        stroke="none"
        animate={{ scale: hovered ? [0.6, 1.15, 1] : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        style={{ willChange: "transform" }}
      />
    </motion.svg>
  );
}

function UsersIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg {...svgProps}>
      <motion.g
        animate={{ x: hovered ? 3 : 0 }}
        transition={SNAP}
        style={{ willChange: "transform" }}
      >
        <circle cx="16.5" cy="8.2" r="2.4" />
        <path d="M12.8 18c.5-2.6 2-4 3.7-4s3.2 1.4 3.7 4" />
      </motion.g>
      <circle cx="9.2" cy="8" r="2.8" />
      <path d="M3.6 18.2c.7-3.2 2.6-4.9 5.6-4.9s4.9 1.7 5.6 4.9" />
    </svg>
  );
}

function SettingsIcon({ hovered }: { hovered: boolean }) {
  return (
    <motion.svg
      {...svgProps}
      animate={{ rotate: hovered ? 90 : 0 }}
      transition={SNAP}
      style={{ willChange: "transform", transformOrigin: "center" }}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </motion.svg>
  );
}
