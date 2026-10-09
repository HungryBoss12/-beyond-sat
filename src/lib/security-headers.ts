/**
 * Security headers for every response the Worker emits (H3).
 *
 * CSP design notes — every allow-listed origin below is load-bearing:
 *  - script-src 'unsafe-inline'  : TanStack Start emits inline hydration-data
 *    <script> tags in the SSR document; there is no nonce plumbing through the
 *    Start renderer yet. Removing this needs framework support, not config.
 *  - script-src 'wasm-unsafe-eval': sql.js (Anki .apkg import) instantiates
 *    /sql-wasm.wasm, which WebAssembly compilation requires.
 *  - script-src www.desmos.com   : the SAT math calculator (DesmosCalculator)
 *    loads Desmos' calculator.js from their CDN at runtime.
 *  - style-src  'unsafe-inline'  : KaTeX renders markup with inline style
 *    attributes; React inline styles generally.
 *  - style/font Google Fonts     : loaded from __root.tsx head links.
 *  - img-src supabase.co         : signed storage URLs (question images,
 *    notification images); pravatar (landing avatars); img.youtube.com thumbs.
 *  - frame-src youtube-nocookie  : FeaturedVideos embeds.
 *    www.desmos.com              : Desmos calculator iframe fallback.
 *  - worker-src 'self' blob:     : pdf.js worker (same-origin via Vite ?url,
 *    blob: fallback).
 *  - connect-src supabase.co     : the browser only ever talks to this origin
 *    plus our own /api/* routes. OpenRouter/Telegram/etc. are server-side only.
 *    wss: covers Supabase realtime sockets.
 *  - media-src https:            : lesson videos come from signed storage URLs,
 *    and homework videos can be a direct link to any site.
 *  - cloudflareinsights          : Cloudflare injects its analytics beacon into
 *    every page and it reports back to cloudflareinsights.com.
 *  - desmos connect/font         : the Desmos API build loads its own assets
 *    when an admin sets a key.
 *
 * Enforced when CSP_ENFORCE=1 (set in wrangler.jsonc vars); otherwise sent as
 * `Content-Security-Policy-Report-Only`.
 */

import { readEnv } from "./server-env";

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.desmos.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com https://www.desmos.com",
  "img-src 'self' data: blob: https://i.pravatar.cc https://img.youtube.com https://*.supabase.co https://www.desmos.com",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com https://www.desmos.com",
  "frame-src https://www.youtube-nocookie.com https://www.desmos.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

function cspEnforced(env: unknown): boolean {
  if (import.meta.env.DEV) return false; // never hard-fail HMR/dev
  const raw = readEnv(env, "CSP_ENFORCE");
  return raw === "1" || raw === "true";
}

/** The always-on, non-CSP hardening headers. */
export function securityHeaders(env: unknown): Record<string, string> {
  const headers: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
  };
  if (cspEnforced(env)) {
    headers["content-security-policy"] = CSP_POLICY;
  } else {
    headers["content-security-policy-report-only"] = CSP_POLICY;
  }
  return headers;
}

/**
 * Attach the security headers to a response without disturbing its body —
 * SSE streams from /api/ai/chat pass straight through, so the body stream is
 * never cloned or buffered. Headers on a same-origin constructed Response are
 * mutable; the reconstruction fallback covers runtimes that make them
 * immutable (e.g. responses proxied from `fetch()` upstreams).
 */
export function applySecurityHeaders(response: Response, env: unknown): Response {
  const headers = securityHeaders(env);
  try {
    for (const [name, value] of Object.entries(headers)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
    return response;
  } catch {
    const merged = new Headers(response.headers);
    for (const [name, value] of Object.entries(headers)) {
      if (!merged.has(name)) merged.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: merged,
    });
  }
}
