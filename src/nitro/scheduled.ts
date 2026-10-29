import { definePlugin } from "nitro";
import { applyRecurringFees } from "../lib/billing/recurring-cron";
import { notifySupportStarting } from "../lib/support/starting-soon";

// The worker's cron only reaches the app through this Nitro hook; a scheduled()
// export on the TanStack server entry is never called.
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook(
    "cloudflare:scheduled",
    async (payload: { env: unknown; controller?: { cron?: string } }) => {
      const cron = payload.controller?.cron ?? "";
      try {
        if (cron === "*/5 * * * *") {
          await notifySupportStarting(payload.env);
          return;
        }
        await applyRecurringFees(payload.env);
      } catch (error) {
        console.error(cron === "*/5 * * * *" ? "[support] start notices failed" : "[billing] recurring fees failed", error);
      }
    },
  );
});
