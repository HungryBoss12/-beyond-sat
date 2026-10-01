import { toast } from "sonner";
import { chargeMonth, isNoPricedGroupsError } from "@/lib/billing/api";
import { monthStart, tashkentToday } from "@/lib/billing/dates";

/** "Charge fee" / "Charge this month": the current Tashkent month for every priced sub-class. */
export async function chargeThisMonth(input: {
  userId: string;
  name: string;
  active: boolean;
}): Promise<boolean> {
  if (!input.active && !confirm(`${input.name} is not active. Charge this month anyway?`)) {
    return false;
  }
  try {
    const added = await chargeMonth(input.userId, monthStart(tashkentToday()));
    if (added > 0) toast.success(`Charged ${input.name}`);
    else toast.message("This month's fee is already charged");
    return added > 0;
  } catch (err) {
    if (isNoPricedGroupsError(err)) {
      toast.error("No priced sub-class for this student. Set a group fee in Classes.");
    } else {
      toast.error(err instanceof Error ? err.message : "Charge failed");
    }
    return false;
  }
}
