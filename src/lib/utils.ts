import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : fallback;
}

/** Signup stores "Graduated" as 13 — the only value above 12. */
export function formatGrade(grade: unknown): string | null {
  if (grade == null || grade === "") return null;
  const n = Number(grade);
  if (n === 13) return "Graduated";
  if (!Number.isFinite(n)) return String(grade);
  const suffix = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}
