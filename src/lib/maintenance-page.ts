/**
 * The 503 maintenance page.
 *
 * Modelled on error-page.ts: a self-contained HTML string with inline styles and
 * no imports, because it has to render when the app is deliberately unavailable.
 * Anything that reached into the bundle would defeat the point.
 *
 * master_plan.md §5C asks for a "sleek dark" page. This is white + brand blue
 * instead — a deliberate deviation, since the rest of the platform is a light
 * theme and a dark 503 would read as a different product.
 */

/** Admin-authored message, so it must be escaped before it reaches the markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DEFAULT_MESSAGE =
  "Beyond SAT is undergoing scheduled updates. We'll be back shortly — your progress is safe.";

export function renderMaintenancePage(message: string): string {
  const body = escapeHtml(message.trim() || DEFAULT_MESSAGE);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Back soon — Beyond SAT</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <style>
      :root { --brand: #11269D; --brand-mid: #2E43C4; --brand-soft: #B8C0E8; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; padding: 1.5rem;
        display: grid; place-items: center;
        font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #0f172a; background: #fff;
      }
      /* Static ambient wash — the same radial brand tint the live site draws
         under the cursor, fixed in place here since there's no JS. */
      body::before {
        content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background: radial-gradient(circle 40rem at 50% 12%, rgba(46,67,196,.10), rgba(46,67,196,.04) 38%, transparent 68%);
      }
      .card {
        position: relative; z-index: 1;
        width: 100%; max-width: 30rem; text-align: center;
        border-radius: 1.25rem; padding: 2.5rem 2rem;
        background: linear-gradient(160deg, var(--brand) 0%, #0C1B70 100%);
        border: 1px solid rgba(46,67,196,.5);
        box-shadow: 0 18px 48px -12px rgba(17,38,157,.45);
        color: #fff;
      }
      .badge {
        display: inline-flex; align-items: center; gap: .5rem;
        padding: .35rem .75rem; border-radius: 999px;
        background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.2);
        font-size: .65rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
      }
      .dot { width: .4rem; height: .4rem; border-radius: 999px; background: var(--brand-soft); }
      h1 { margin: 1.25rem 0 .625rem; font-size: 1.6rem; font-weight: 800; letter-spacing: -.02em; }
      p { margin: 0; color: var(--brand-soft); }
      .actions { margin-top: 1.75rem; }
      button {
        font: inherit; font-weight: 700; cursor: pointer;
        padding: .7rem 1.4rem; border-radius: .625rem; border: 0;
        background: #fff; color: var(--brand);
        box-shadow: 0 6px 18px -6px rgba(0,0,0,.4);
      }
      button:hover { background: #EEF1FB; }
      .foot { margin-top: 1.5rem; font-size: .75rem; color: #64748b; position: relative; z-index: 1; text-align: center; }
      .foot a { color: var(--brand-mid); }
    </style>
  </head>
  <body>
    <div>
      <main class="card">
        <span class="badge"><span class="dot"></span> Scheduled maintenance</span>
        <h1>We'll be right back</h1>
        <p>${body}</p>
        <div class="actions">
          <button type="button" onclick="location.reload()">Check again</button>
        </div>
      </main>
      <p class="foot">Already an admin? <a href="/signin">Sign in</a> to keep working.</p>
    </div>
  </body>
</html>`;
}

export function maintenanceResponse(message: string): Response {
  return new Response(renderMaintenancePage(message), {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Must never be cached — the whole point is that it stops applying the
      // moment an admin flips the switch back.
      "cache-control": "no-store, must-revalidate",
      "retry-after": "600",
    },
  });
}
