import {
  CircleCheck,
  FlaskConical,
  Snowflake,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { MemberStatus } from "@/lib/classes/types";
import type { BalanceKind } from "@/lib/billing/money";

/** Balance kind and member status are shown as brand lightness + icon + word, never colour alone. */
export const KIND_META: Record<BalanceKind, { label: string; icon: LucideIcon; tone: string }> = {
  debt: { label: "Debt", icon: TriangleAlert, tone: "bg-brand-25 text-brand-900" },
  settled: { label: "Settled", icon: CircleCheck, tone: "bg-brand-700 text-white" },
  credit: { label: "Credit", icon: Wallet, tone: "bg-brand-300 text-white" },
};

export const STATUS_META: Record<MemberStatus, { label: string; icon: LucideIcon }> = {
  active: { label: "Active", icon: CircleCheck },
  trial: { label: "Trial", icon: FlaskConical },
  frozen: { label: "Frozen", icon: Snowflake },
  left: { label: "Left", icon: CircleCheck },
};
