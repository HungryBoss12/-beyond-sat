import { BookOpen, Calculator } from "lucide-react";
import type { ClassSubject } from "@/lib/classes/types";
import { cn } from "@/lib/utils";

/** Maths = brand-300 outline + Calculator; Eng = brand-200 fill + BookOpen. */
export function SubclassChip({
  subject,
  name,
  className,
}: {
  subject: ClassSubject;
  name: string;
  className?: string;
}) {
  const Icon = subject === "math" ? Calculator : BookOpen;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        subject === "math"
          ? "border border-brand-300 text-white"
          : "bg-brand-200 text-brand-900",
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}
