/**
 * `vite dev` reads `.dev.vars`, which holds production secrets. Binding to every
 * interface let anyone on the same network download it, so the server stays on
 * loopback; `npx vite dev --host` opts in for phone testing.
 */
export const DEV_SERVER_HOST = "localhost";

/** Replaces Vite's default list rather than extending it, so the defaults are repeated. */
export const DEV_SERVER_FS_DENY = [
  ".env",
  ".env.*",
  ".dev.vars",
  ".dev.vars.*",
  "*.{crt,pem}",
  "**/.git/**",
];
