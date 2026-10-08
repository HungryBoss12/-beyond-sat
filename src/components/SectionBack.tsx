import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const SECTIONS = new Set(["vocab", "lessons", "practice", "classes", "analysis", "admin"]);

const SEGMENT_LABELS: Record<string, string> = {
  vocab: "Vocabulary",
  lessons: "Lessons",
  practice: "Practice",
  classes: "Classes",
  analysis: "Analysis",
  admin: "Admin",
  dashboard: "Dashboard",
  decks: "Decks",
  tests: "Tests",
  sqb: "SQB",
  daily: "Daily",
  mock: "Mock exams",
  users: "Users",
  questions: "Questions",
  import: "Import",
  payments: "Payments",
  notifications: "Notifications",
  news: "News",
  settings: "Settings",
  assignments: "Assignments",
  applies: "Applies",
  session: "Session",
};

/** Pathless layouts that only redirect. The arrow should land on the real list. */
const PARENT_ALIAS: Record<string, string> = {
  "/vocab/deck": "/vocab/decks",
  "/practice/session": "/practice",
  "/analysis/session": "/analysis",
};

function titleFromSegment(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isIdSegment(segment: string): boolean {
  return /^[0-9a-f-]{16,}$/i.test(segment);
}

/**
 * One level up from a nested section page. Section roots return null.
 * Full-screen players already carry their own parent link, so they return null too.
 */
export function sectionBackTarget(pathname: string): { to: string; label: string } | null {
  const path = pathname.replace(/\/$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2 || !SECTIONS.has(parts[0])) return null;
  if (/^\/vocab\/deck\/[^/]+/.test(path)) return null;
  if (/^\/vocab\/tests\/[^/]+/.test(path)) return null;
  if (path.startsWith("/practice/session/")) return null;
  if (path.startsWith("/analysis/session/")) return null;
  if (parts[0] === "lessons" && parts.length >= 4) return null;

  let parent = "/" + parts.slice(0, -1).join("/");
  if (PARENT_ALIAS[parent]) parent = PARENT_ALIAS[parent];
  const parentParts = parent.split("/").filter(Boolean);
  const labelSource = [...parentParts].reverse().find((part) => !isIdSegment(part));
  if (!labelSource) return null;
  return { to: parent, label: titleFromSegment(labelSource) };
}

export function SectionBack() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const back = sectionBackTarget(pathname);
  if (!back) return null;
  return (
    <Link
      to={back.to as "/dashboard"}
      className="nudge group mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-600"
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
      {back.label}
    </Link>
  );
}
