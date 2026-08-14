import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests run against plain modules, so this config deliberately does not
 * reuse `vite.config.ts` — loading the app's TanStack Start / nitro plugin chain
 * inside the test runner crashes the worker before any test executes.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /* The default worker-thread pool segfaults on some Windows setups before any
       test runs. Child processes cost a little startup time and don't. */
    pool: "forks",
  },
});
