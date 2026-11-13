import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { lookFor, LOOKS, type OrbLook } from "@/components/landing/beyond-core-looks";
import { quietEvents } from "@/components/landing/quiet-events";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  Color,
  EdgesGeometry,
  IcosahedronGeometry,
  PerspectiveCamera,
  WebGLRenderer,
  type Group,
  type LineBasicMaterial,
  type LineSegments,
  type Mesh,
  type MeshStandardMaterial,
  type WebGLRendererParameters,
} from "three";

/**
 * The WebGL half of the hero emblem (master_plan.md §1).
 *
 * This module is the lazy chunk — it is the ONLY file in the app that imports
 * `three` or `@react-three/fiber`, and it is reached exclusively through
 * `React.lazy` in BeyondCore.tsx. Importing it anywhere eagerly would pull
 * ~400KB into the initial landing bundle and defeat the whole arrangement.
 *
 * Deliberately built from core three primitives only — no `drei`. The emblem
 * needs a polyhedron, a standard material and two point lights, all of which
 * R3F exposes directly; drei would have added three packages for nothing.
 *
 * Brand hexes are repeated here because three takes colours as values, not
 * classes. They match --color-brand-* in styles.css: 200 #9f9fc2, 400 #535291,
 * 500 #100e66, 600 #0b0761.
 */

const BRAND_200 = "#9f9fc2";

/** Scroll progress through the hero, 0 → 1, clamped. */
function heroProgress() {
  if (typeof window === "undefined") return 0;
  // One viewport of scroll is the full sweep. Beyond that the hero is off-screen
  // and the value pins at 1, so the mesh settles rather than drifting forever.
  const denominator = window.innerHeight || 1;
  return Math.min(1, Math.max(0, window.scrollY / denominator));
}

/** How far the pointer can turn the emblem, in radians, at the edge of the canvas. */
const POINTER_YAW = 0.32;
const POINTER_PITCH = 0.22;

/* Drag physics. Radians of spin per pixel dragged, how fast a released spin dies out, how hard the
   pitch is pulled back to level, and the spin an automatic story change adds. */
const DRAG_GAIN = 0.011;
const SPIN_FRICTION = 1.6;
const SPIN_LIMIT = 14;
const PITCH_STIFFNESS = 14;
const PITCH_DAMPING = 5;
const PITCH_LIMIT = 1.1;
const KICK_SPIN = 7;

type DragState = { active: boolean; dx: number; dy: number };
type Phase = "idle" | "out" | "in";

function Shape({ look }: { look: OrbLook }) {
  const args = useMemo(() => [look.radius, look.detail] as [number, number], [look]);
  if (look.shape === "dodeca") return <dodecahedronGeometry args={args} />;
  if (look.shape === "octa") return <octahedronGeometry args={args} />;
  if (look.shape === "tetra") return <tetrahedronGeometry args={args} />;
  return <icosahedronGeometry args={args} />;
}

/**
 * The emblem: a faceted core inside a slowly counter-rotating wireframe shell.
 *
 * Inputs summed onto the group's transform: time (a slow idle spin, so the object is alive before
 * the visitor touches anything), scroll (rotation and depth), the pointer (a small lean toward the
 * cursor), and, when interactive, a drag with real inertia. All of them go on the group rather than
 * the camera — moving the camera would also move the lights, which are what give the facets their
 * definition.
 *
 * Changing `variant` plays a kick: the emblem shrinks on a spring, swaps shape at the bottom, springs
 * back with an overshoot, takes a burst of spin, and eases its colours to the new look.
 */
function Emblem({
  over,
  pointer,
  drag,
  variant,
  lite,
}: {
  over: { current: boolean };
  pointer: { current: { x: number; y: number } };
  drag: { current: DragState };
  variant: number;
  /** Coarser wire shell. The sign-in slot is small, and the dense shell is what Firefox struggles to redraw. */
  lite: boolean;
}) {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const shell = useRef<LineSegments>(null);
  const coreMat = useRef<MeshStandardMaterial>(null);
  const shellMat = useRef<LineBasicMaterial>(null);

  /* Smoothed scroll value. Reading window.scrollY straight into the transform
     makes the mesh jitter on trackpads, which emit many small deltas per frame;
     easing toward the target turns that into a glide. */
  const scroll = useRef(0);

  /* The pointer is smoothed the same way and for the same reason: R3F's
     `state.pointer` snaps to wherever the cursor is this frame, and a fast flick
     across the canvas would jerk the mesh. Held as a pair rather than a Vector2
     so nothing here has to construct a three object per frame. */
  const aimX = useRef(0);
  const aimY = useRef(0);

  /* `swell` eases toward the canvas hover flag. The flag lives outside the
     frame loop so a pointer enter does not re-render the scene. */
  const swell = useRef(0);

  // Spin angle and velocity from dragging and kicks, plus the pitch that springs back to level.
  const phys = useRef({ ay: 0, vy: 0, ax: 0, vx: 0 });
  // Scale spring used by the kick and the press-in while dragging.
  const squash = useRef({ x: 1, v: 0 });
  const phase = useRef<Phase>("idle");

  const [shownVariant, setShownVariant] = useState(variant);
  const wanted = useRef(variant);
  const announced = useRef(variant);
  useEffect(() => {
    wanted.current = variant;
  }, [variant]);

  const look = lookFor(shownVariant);
  const [initialLook] = useState(() => lookFor(variant));
  const palette = useMemo(
    () =>
      LOOKS.map((l) => ({
        core: new Color(l.core),
        emissive: new Color(l.emissive),
        shell: new Color(l.shell),
      })),
    [],
  );

  useFrame((state, delta) => {
    if (!group.current || !core.current || !shell.current) return;

    // delta is clamped because a backgrounded tab resumes with a huge delta,
    // which would snap the mesh a quarter turn in one frame.
    const step = Math.min(delta, 0.05);
    scroll.current += (heroProgress() - scroll.current) * Math.min(1, step * 6);

    /* Pointer comes from a DOM listener on the canvas, normalised to -1…1.
       It rests at (0, 0) until the pointer enters, which is also where a touch
       device leaves it — a phone gets the scroll and idle terms only. */
    const ease = Math.min(1, step * 4);
    aimX.current += (pointer.current.x - aimX.current) * ease;
    aimY.current += (pointer.current.y - aimY.current) * ease;

    // A new variant starts the kick: shrink, swap at the bottom, spring back, and spin.
    const p = phys.current;
    if (wanted.current !== announced.current) {
      announced.current = wanted.current;
      phase.current = "out";
      p.vy += KICK_SPIN;
    }

    const dragging = drag.current.active;
    if (dragging) {
      const ry = drag.current.dx * DRAG_GAIN;
      const rx = drag.current.dy * DRAG_GAIN;
      drag.current.dx = 0;
      drag.current.dy = 0;
      p.ay += ry;
      p.ax = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p.ax + rx));
      // Low-passed velocity, so letting go carries the speed of the last few frames.
      p.vy += (ry / step - p.vy) * 0.5;
      p.vx = 0;
    } else {
      p.ay += p.vy * step;
      p.vy *= Math.exp(-SPIN_FRICTION * step);
      p.vy = Math.max(-SPIN_LIMIT, Math.min(SPIN_LIMIT, p.vy));
      p.vx += (-PITCH_STIFFNESS * p.ax - PITCH_DAMPING * p.vx) * step;
      p.ax += p.vx * step;
    }

    const t = state.clock.elapsedTime;
    const s = scroll.current;

    group.current.rotation.y = t * 0.18 + s * Math.PI * 1.2 + aimX.current * POINTER_YAW + p.ay;
    group.current.rotation.x =
      Math.sin(t * 0.25) * 0.12 + s * 0.5 - aimY.current * POINTER_PITCH + p.ax;

    // Recedes and shrinks as the page scrolls past — the parallax cue that ties
    // the object to the scroll position without moving the camera.
    const depth = s * -1.6;
    group.current.position.z = depth;
    group.current.position.y = Math.sin(t * 0.5) * 0.08 - s * 0.3;

    /* Leans very slightly toward the cursor as well as turning. Rotation alone
       reads as the object spinning; a little translation reads as it noticing.
       Kept under a tenth of a unit so it never breaks the hero's layout. */
    group.current.position.x = aimX.current * 0.09;

    /* Swells slightly while the pointer is actually over the emblem. Eased in the
       frame loop rather than set from the event handler, so a fast pointer-out
       glides back instead of snapping — and eased through a ref rather than React
       state, which would re-render the scene on every enter and leave. */
    swell.current += ((over.current ? 1 : 0) - swell.current) * Math.min(1, step * 5);

    // Scale spring: stiff on the way down, loose on the way back so it overshoots.
    const out = phase.current === "out";
    const goal = out ? 0.2 : dragging ? 0.94 : 1;
    const sq = squash.current;
    const stiffness = out ? 220 : 110;
    const damping = out ? 26 : 9;
    sq.v += ((goal - sq.x) * stiffness - sq.v * damping) * step;
    sq.x += sq.v * step;
    if (out && sq.x < 0.3) {
      phase.current = "in";
      setShownVariant(wanted.current);
    } else if (phase.current === "in" && Math.abs(sq.x - 1) < 0.01 && Math.abs(sq.v) < 0.05) {
      phase.current = "idle";
    }
    const scale = sq.x * (1 + swell.current * 0.05);
    if (Number.isFinite(scale))
      group.current.scale.setScalar(Math.min(1.15, Math.max(0.15, scale)));

    // The shell counter-rotates so the two layers shear against each other;
    // rotating together would read as one solid object. A drag drags it the other way too.
    shell.current.rotation.y = -t * 0.32 - p.ay * 0.6;
    shell.current.rotation.z = t * 0.1;

    // Colours chase the wanted look rather than snapping to it.
    const target =
      palette[((Math.trunc(wanted.current) % palette.length) + palette.length) % palette.length];
    const k = Math.min(1, step * 3.5);
    coreMat.current?.color.lerp(target.core, k);
    coreMat.current?.emissive.lerp(target.emissive, k);
    shellMat.current?.color.lerp(target.shell, k);
  });

  return (
    /* No R3F pointer handlers. Fiber copies every enumerable field of the native
       event, and Firefox logs mozPressure / mozInputSource plus a file:// security
       error for that copy. Hover and drag are DOM listeners on the canvas instead. */
    <group ref={group}>
      <mesh ref={core}>
        <Shape key={`${look.shape}-${look.detail}`} look={look} />
        {/* flatShading is what makes the facets legible — with smooth normals a
            polyhedron reads as a slightly lumpy sphere. */}
        <meshStandardMaterial
          ref={coreMat}
          color={initialLook.core}
          emissive={initialLook.emissive}
          emissiveIntensity={lite ? 0.7 : 0.45}
          roughness={lite ? 0.35 : 0.28}
          metalness={lite ? 0.2 : 0.55}
          flatShading
        />
      </mesh>

      {/* Edges, not a wireframe material. wireframe triangulates the shell, and some
          GPUs draw that as one filled triangle that covers the core. */}
      <WireShell lite={lite} color={initialLook.shell} shellRef={shell} materialRef={shellMat} />
    </group>
  );
}

/** The cage around the core. Line segments stay lines on the GPUs that break wireframe. */
function WireShell({
  lite,
  color,
  shellRef,
  materialRef,
}: {
  lite: boolean;
  color: string;
  shellRef?: Ref<LineSegments>;
  materialRef?: Ref<LineBasicMaterial>;
}) {
  const geometry = useMemo(() => {
    const shape = new IcosahedronGeometry(1.85, lite ? 0 : 1);
    const edges = new EdgesGeometry(shape);
    shape.dispose();
    return edges;
  }, [lite]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments ref={shellRef} geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.55}
        toneMapped={false}
      />
    </lineSegments>
  );
}

/**
 * Static variant for `prefers-reduced-motion`. Same geometry and lighting, no
 * `useFrame` — the render loop never starts, so there is no motion to freeze
 * mid-frame and no per-frame cost. A new variant simply swaps the look.
 *
 * A scroll-driven 3D scene is exactly the content that triggers vestibular
 * symptoms, so this is a hard requirement rather than a nicety.
 */
function StaticEmblem({ variant }: { variant: number }) {
  const look = lookFor(variant);
  return (
    <group rotation={[0.35, 0.6, 0]}>
      <mesh>
        <Shape look={look} />
        <meshStandardMaterial
          color={look.core}
          emissive={look.emissive}
          emissiveIntensity={0.45}
          roughness={0.28}
          metalness={0.55}
          flatShading
        />
      </mesh>
      <WireShell lite={false} color={look.shell} />
    </group>
  );
}

/** Keeps the whole orb in frame. A canvas that first measures as 0px tall leaves the
    camera with a broken aspect, and the core then paints as one clipped triangle. */
function CameraFit() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    if (size.width < 8 || size.height < 8) return;
    camera.aspect = size.width / size.height;
    camera.position.set(0, 0, 5);
    camera.fov = 42;
    camera.near = 0.1;
    camera.far = 30;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/**
 * Three logs "Context Lost" from its own listener, and Fiber then calls
 * `forceContextLoss` on unmount, which makes Firefox print the same loss again.
 * A real GPU drop still reaches `onLost` while the canvas is on the page.
 */
function createRenderer(
  canvas: HTMLCanvasElement,
  antialias: boolean,
  onLost: () => void,
  lowPower = true,
) {
  const params: WebGLRendererParameters = {
    canvas,
    alpha: true,
    antialias,
    powerPreference: lowPower ? "low-power" : "default",
  };

  const nativeAdd = canvas.addEventListener.bind(canvas);
  const held: { renderer?: WebGLRenderer } = {};
  canvas.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type !== "webglcontextlost") {
      nativeAdd(type, listener, options);
      return;
    }
    nativeAdd(
      type,
      (event: Event) => {
        event.preventDefault();
        if (!canvas.isConnected) return;
        held.renderer?.setAnimationLoop(null);
        onLost();
      },
      options,
    );
  }) as typeof canvas.addEventListener;

  try {
    const renderer = new WebGLRenderer(params);
    held.renderer = renderer;
    renderer.forceContextLoss = () => {};
    // Firefox warns when the GL viewport is even a fraction larger than the
    // drawing buffer. Flooring to whole device pixels makes them equal, and
    // leaving the CSS size alone lets the 100% style own the box.
    const nativeSetSize = renderer.setSize.bind(renderer);
    renderer.setSize = (width: number, height: number) => {
      const ratio = renderer.getPixelRatio() || 1;
      const w = Math.max(1, Math.floor(width * ratio)) / ratio;
      const h = Math.max(1, Math.floor(height * ratio)) / ratio;
      nativeSetSize(w, h, false);
    };
    return renderer;
  } finally {
    canvas.addEventListener = nativeAdd;
  }
}

/** Draws the lite emblem at 30fps, and not at all while the tab or the canvas is hidden. */
function Pace() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    let onScreen = true;
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    observer.observe(canvas);
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || !onScreen) return;
      if (now - last < 1000 / 30) return;
      last = now;
      invalidate();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [gl, invalidate]);
  return null;
}

function pixelRatio(lite: boolean, highDpr: boolean): [number, number] {
  if (lite) return [1, 1];
  if (highDpr) return [1, 2];
  return [1, 1.5];
}

function frameLoop(animate: boolean, lite: boolean): "always" | "demand" {
  if (!animate || lite) return "demand";
  return "always";
}

export default function BeyondCoreScene({
  animate,
  highDpr,
  onContextLost,
  interactive,
  variant,
  lite = false,
}: {
  /** false under `prefers-reduced-motion` — renders one frame and stops. */
  animate: boolean;
  /** false on small viewports; caps the pixel ratio to keep phones cool. */
  highDpr: boolean;
  /** The GPU dropped the live context. The parent swaps in the 2D mockup. */
  onContextLost: () => void;
  /** Drag to spin with inertia. */
  interactive: boolean;
  /** Which look to show; a change plays the kick. */
  variant: number;
  /** Cheap path for a small second emblem. 30fps, no antialiasing, one light. */
  lite?: boolean;
}) {
  const onLost = useRef(onContextLost);
  onLost.current = onContextLost;
  const over = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });
  const drag = useRef<DragState>({ active: false, dx: 0, dy: 0 });
  // Detaches the canvas listeners. Set once the canvas exists, called when the scene unmounts.
  const detach = useRef<() => void>(() => undefined);
  useEffect(() => () => detach.current(), []);

  return (
    <Canvas
      /* `frameloop: demand` renders exactly one frame and then only on request.
         Combined with the static emblem this is what makes reduced-motion free
         rather than merely still. */
      frameloop={frameLoop(animate, lite)}
      dpr={pixelRatio(lite, highDpr)}
      shadows={false}
      camera={{ position: [0, 0, 5], fov: 42 }}
      /* The page is white and the emblem is deep blue, so the canvas stays
         transparent and the hero's own background shows through. */
      gl={(defaults) => {
        const canvas = defaults.canvas;
        if (!(canvas instanceof HTMLCanvasElement)) {
          return new WebGLRenderer({
            alpha: true,
            antialias: !lite && highDpr,
            powerPreference: lite ? "default" : "low-power",
          });
        }
        return createRenderer(canvas, !lite && highDpr, () => onLost.current(), !lite);
      }}
      style={
        lite
          ? { width: "100%", height: "100%", transform: "translateZ(0)" }
          : { width: "100%", height: "100%" }
      }
      resize={{ offsetSize: true }}
      events={quietEvents}
      onCreated={({ gl: renderer }) => {
        const el = renderer.domElement;
        const enter = () => {
          over.current = true;
        };
        const leave = () => {
          over.current = false;
          pointer.current.x = 0;
          pointer.current.y = 0;
        };
        const move = (event: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.current.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        };
        el.addEventListener("pointerenter", enter);
        el.addEventListener("pointerleave", leave);
        el.addEventListener("pointermove", move);

        /* Drag to spin. The frame loop reads and clears the accumulated delta, so the handlers only
           add to it. `pan-y` keeps vertical page scrolling working on touch while a sideways drag
           turns the emblem. Pointer capture keeps the drag alive when the cursor leaves the canvas. */
        let last = { x: 0, y: 0 };
        const down = (event: PointerEvent) => {
          drag.current.active = true;
          last = { x: event.clientX, y: event.clientY };
          el.setPointerCapture(event.pointerId);
          el.style.cursor = "grabbing";
        };
        const drive = (event: PointerEvent) => {
          if (!drag.current.active) return;
          drag.current.dx += event.clientX - last.x;
          drag.current.dy += event.clientY - last.y;
          last = { x: event.clientX, y: event.clientY };
        };
        const up = (event: PointerEvent) => {
          drag.current.active = false;
          if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
          el.style.cursor = "grab";
        };
        if (interactive) {
          el.style.cursor = "grab";
          el.style.touchAction = "pan-y";
          el.addEventListener("pointerdown", down);
          el.addEventListener("pointermove", drive);
          el.addEventListener("pointerup", up);
          el.addEventListener("pointercancel", up);
        }

        detach.current = () => {
          el.removeEventListener("pointerenter", enter);
          el.removeEventListener("pointerleave", leave);
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerdown", down);
          el.removeEventListener("pointermove", drive);
          el.removeEventListener("pointerup", up);
          el.removeEventListener("pointercancel", up);
        };
      }}
    >
      <CameraFit />
      {lite && animate ? <Pace /> : null}
      {/* Two point lights plus a dim ambient: the ambient stops the unlit faces
          going pure black, which on a white page looks like a hole. The lite
          slot adds a third light in front, because a small metal orb was reading as a dark blob. */}
      <ambientLight intensity={lite ? 1.15 : 0.55} />
      <pointLight position={[4, 3, 5]} intensity={lite ? 110 : 55} color="#ffffff" distance={22} />
      <pointLight
        position={[-4, -2, 3]}
        intensity={lite ? 60 : 30}
        color={BRAND_200}
        distance={18}
      />
      {lite ? (
        <pointLight position={[0, 1, 6]} intensity={45} color="#ffffff" distance={16} />
      ) : null}
      {animate ? (
        <Emblem over={over} pointer={pointer} drag={drag} variant={variant} lite={lite} />
      ) : (
        <StaticEmblem variant={variant} />
      )}
    </Canvas>
  );
}
