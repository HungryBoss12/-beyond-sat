import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { DashboardMockup } from "@/components/landing/DashboardMockup";

/**
 * The hero emblem (master_plan.md §1) and the guards it ships behind.
 *
 * This file deliberately imports NOTHING from `three` or `@react-three/fiber` —
 * all of that lives in BeyondCoreScene.tsx, reached only through the React.lazy
 * call below. That is what keeps ~800KB of WebGL out of the initial landing
 * bundle. Adding a static `three` import here would silently undo it.
 *
 * The guards, all mandatory:
 *   1. lazy + Suspense      — WebGL never enters the initial bundle
 *   2. never in the SSR graph — see the import.meta.env.SSR branch below
 *   3. deferred until idle  — the chunk never competes with hydration
 *   4. dpr / antialias step — capped on small viewports, shadows off everywhere
 *   5. prefers-reduced-motion → a static poster frame, no render loop
 *   6. no WebGL context     → falls back to <DashboardMockup />
 *   7. error boundary       → a failed chunk or a scene throw also falls back
 *
 * Guards 6 and 7 matter more than they look. Without them a machine with WebGL
 * disabled, or a browser that got a stale chunk URL after a deploy, gets a blank
 * column where the hero visual should be — which is worse than the 2D mockup it
 * replaced, and fails silently so nobody finds out.
 */

type SceneProps = { animate: boolean; highDpr: boolean };

/**
 * `React.lazy` alone does NOT keep three out of the server build.
 *
 * Rollup hoisted the scene's dependency into a shared chunk that the SSR route
 * graph imported *statically*, so `three` evaluated while the Worker was still
 * loading its global scope. Its module-level `new LoadingManager()` trips the
 * Workers runtime rule that forbids I/O, timers and randomness outside a
 * handler, and every document request 500'd before any of our code ran.
 *
 * `import.meta.env.SSR` is replaced with a literal at build time, so on the
 * server this whole ternary folds to the stub and the `import()` becomes
 * unreachable — the scene never enters the server module graph at all. A
 * `typeof window` check would not work here: it is evaluated at runtime, so the
 * bundler still has to keep the import.
 *
 * The stub is never rendered in practice — `support` only reaches "webgl" from
 * a client effect — it exists so the SSR branch has something to type against.
 */
const BeyondCoreScene: ComponentType<SceneProps> = import.meta.env.SSR
  ? function SceneSsrStub() {
      return null;
    }
  : (lazy(
      () => import("@/components/landing/BeyondCoreScene"),
    ) as unknown as ComponentType<SceneProps>);

/** Feature-detects a real WebGL context once, on the client. */
function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    // Some environments hand back a context that is immediately lost; releasing
    // it explicitly also stops this probe from holding a GPU context open.
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Falls back to the 2D mockup if anything below it throws.
 *
 * A rejected `import()` — the stale-chunk case after a deploy, or a flaky
 * connection — surfaces as a render error, and `<Suspense>` does not catch those.
 * Without this the whole landing route would white-screen because a decorative
 * graphic failed to download.
 */
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Logged rather than swallowed: a permanently failing chunk is a build
    // problem, and the visitor seeing a working fallback would otherwise hide it.
    console.error("[BeyondCore] 3D scene failed to load; using the 2D fallback.", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Support = "pending" | "webgl" | "fallback";

export function BeyondCore() {
  /* Starts as "pending" rather than assuming support, because this runs during
     SSR too — document doesn't exist there, and guessing wrong would mean
     server-rendering a canvas the client then throws away. */
  const [support, setSupport] = useState<Support>("pending");
  const [animate, setAnimate] = useState(true);
  const [highDpr, setHighDpr] = useState(true);

  useEffect(() => {
    if (!detectWebgl()) {
      setSupport("fallback");
      return;
    }

    /* Deferred to an idle callback rather than started here. The scene chunk is
       by far the largest thing the landing page can download, and requesting it
       during hydration makes it compete with the code that makes the page
       interactive — which is what "the site feels slow" actually is. One idle
       tick costs the emblem nothing perceptible and gets the main thread back. */
    let idle = 0;
    let timer = 0;
    const start = () => setSupport("webgl");

    if (typeof requestIdleCallback === "function") {
      idle = requestIdleCallback(start, { timeout: 1500 });
    } else {
      // Safari has no requestIdleCallback; a short timeout is close enough,
      // since the goal is only "after the page is interactive".
      timer = window.setTimeout(start, 200);
    }

    if (!window.matchMedia) return () => cancelIdle(idle, timer);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 768px)");

    const sync = () => {
      setAnimate(!motion.matches);
      setHighDpr(wide.matches);
    };
    sync();

    /* Listening rather than reading once: a visitor can change the OS setting
       mid-session, and rotating a tablet crosses the md breakpoint. */
    motion.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      cancelIdle(idle, timer);
      motion.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  if (support === "fallback") return <DashboardMockup />;

  return (
    <div className="relative">
      {/* Reserves the emblem's box before the chunk arrives so the hero doesn't
          reflow when it lands. The aspect ratio is fixed rather than the height
          so it scales down cleanly on narrow viewports. */}
      <div className="relative mx-auto aspect-square w-full max-w-[28rem]">
        {/* Soft brand halo behind the canvas. Pure CSS, so it's present during
            the pending state too and the area never looks empty — the emblem
            fades in over it rather than appearing in a blank column. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[12%] rounded-full bg-brand-400/20 blur-3xl"
        />
        {/* A faint ring at the emblem's silhouette, shown only while waiting.
            Without it the halo alone reads as an unfinished gradient. */}
        {support === "pending" && (
          <div
            aria-hidden="true"
            className="pulse-ring pointer-events-none absolute inset-[22%] rounded-full border border-brand-400/25"
          />
        )}
        {support === "webgl" && (
          <SceneBoundary fallback={<DashboardMockup />}>
            <Suspense fallback={null}>
              <BeyondCoreScene animate={animate} highDpr={highDpr} />
            </Suspense>
          </SceneBoundary>
        )}
      </div>

      {/* The emblem is decorative; this is what a screen reader gets instead. */}
      <p className="sr-only">
        An animated three-dimensional emblem representing the Beyond AI engine.
      </p>
    </div>
  );
}

function cancelIdle(idle: number, timer: number) {
  if (idle && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
  if (timer) window.clearTimeout(timer);
}
