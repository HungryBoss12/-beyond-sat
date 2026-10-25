import { definePlugin } from "nitro";
import { applyRecurringFees } from "../lib/billing/recurring-cron";

// The worker's cron only reaches the app through this Nitro hook; a scheduled()
// export on the TanStack server entry is never called.
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }: { env: unknown }) => {
    try {
      await applyRecurringFees(env);
    } catch (error) {
      console.error("[billing] recurring fees failed", error);
    }
  });
});
