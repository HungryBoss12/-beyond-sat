import { createContext, useContext } from "react";
import type { ClassRow } from "@/lib/classes/types";
import type { ClassGroup } from "@/lib/classes/groups";

export type ClassContextValue = {
  klass: ClassRow;
  groups: ClassGroup[];
  /** Every parent class, for the "Active group" jump and moves. */
  allClasses: ClassRow[];
  isAdmin: boolean;
  reload: () => Promise<void>;
};

export const ClassContext = createContext<ClassContextValue | null>(null);

export function useClassContext(): ClassContextValue {
  const value = useContext(ClassContext);
  if (!value) throw new Error("useClassContext must be used inside the class layout");
  return value;
}

export function groupFor(groups: ClassGroup[], subject: ClassGroup["subject"]): ClassGroup | null {
  return groups.find((g) => g.subject === subject) ?? null;
}
