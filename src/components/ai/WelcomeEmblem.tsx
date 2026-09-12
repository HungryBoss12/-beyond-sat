import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Sparkles } from "lucide-react";

type SceneProps = { animate: boolean; highDpr: boolean };

const WelcomeEmblemScene: ComponentType<SceneProps> = import.meta.env.SSR
  ? function SceneSsrStub() {
      return null;
    }
  : (lazy(
      () => import("@/components/ai/WelcomeEmblemScene"),
    ) as unknown as ComponentType<SceneProps>);

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[WelcomeEmblem] 3D scene failed; using the Sparkles tile.", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SparklesFallback() {
  return (
    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-400 shadow-brand">
      <Sparkles className="h-7 w-7 text-white" />
    </span>
  );
}

type Support = "pending" | "webgl" | "fallback";

export function WelcomeEmblem() {
  const [support, setSupport] = useState<Support>("pending");
  const [animate, setAnimate] = useState(true);
  const [highDpr, setHighDpr] = useState(true);

  useEffect(() => {
    if (!detectWebgl()) {
      setSupport("fallback");
      return;
    }

    let idle = 0;
    let timer = 0;
    const start = () => setSupport("webgl");
    if (typeof requestIdleCallback === "function") {
      idle = requestIdleCallback(start, { timeout: 1200 });
    } else {
      timer = window.setTimeout(start, 160);
    }

    if (!window.matchMedia) return () => cancelIdle(idle, timer);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      setAnimate(!motion.matches);
      setHighDpr(wide.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      cancelIdle(idle, timer);
      motion.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  if (support === "fallback") return <SparklesFallback />;

  return (
    <div className="relative mx-auto aspect-square w-40 sm:w-48">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[10%] rounded-full bg-brand-400/25 blur-2xl"
      />
      {support === "pending" && (
        <div
          aria-hidden="true"
          className="pulse-ring pointer-events-none absolute inset-[24%] rounded-full border border-brand-400/30"
        />
      )}
      {support === "webgl" && (
        <SceneBoundary fallback={<SparklesFallback />}>
          <Suspense fallback={null}>
            <WelcomeEmblemScene animate={animate} highDpr={highDpr} />
          </Suspense>
        </SceneBoundary>
      )}
      <p className="sr-only">Interactive Beyond SAT emblem</p>
    </div>
  );
}

function cancelIdle(idle: number, timer: number) {
  if (idle && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
  if (timer) window.clearTimeout(timer);
}
