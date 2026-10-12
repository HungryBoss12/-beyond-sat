import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { WebGLRenderer, type Group, type Mesh, type WebGLRendererParameters } from "three";

/**
 * The WebGL half of the hero emblem (master_plan.md §1).
 *
 * This module is the lazy chunk — it is the ONLY file in the app that imports
 * `three` or `@react-three/fiber`, and it is reached exclusively through
 * `React.lazy` in BeyondCore.tsx. Importing it anywhere eagerly would pull
 * ~400KB into the initial landing bundle and defeat the whole arrangement.
 *
 * Deliberately built from core three primitives only — no `drei`. The emblem
 * needs an icosahedron, a standard material and two point lights, all of which
 * R3F exposes directly; drei would have added three packages for nothing.
 *
 * Brand hexes are repeated here because three takes colours as values, not
 * classes. They match --color-brand-* in styles.css: 200 #9f9fc2, 400 #535291,
 * 500 #100e66, 600 #0b0761.
 */

const BRAND_400 = "#535291";
const BRAND_600 = "#0b0761";
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

/**
 * The emblem: a faceted core inside a slowly counter-rotating wireframe shell.
 *
 * Three inputs are summed onto the group's transform: time (a slow idle spin, so
 * the object is alive before the visitor touches anything), scroll (rotation and
 * depth), and the pointer (a small lean toward the cursor). All three go on the
 * group rather than the camera — moving the camera would also move the lights,
 * which are what give the facets their definition.
 */
function Emblem({ over }: { over: { current: boolean } }) {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const shell = useRef<Mesh>(null);

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

  useFrame((state, delta) => {
    if (!group.current || !core.current || !shell.current) return;

    // delta is clamped because a backgrounded tab resumes with a huge delta,
    // which would snap the mesh a quarter turn in one frame.
    const step = Math.min(delta, 0.05);
    scroll.current += (heroProgress() - scroll.current) * Math.min(1, step * 6);

    /* `state.pointer` is already normalised to -1…1 over the canvas, so no
       listener and no getBoundingClientRect is needed. It rests at (0, 0) until
       the pointer first enters, which is also where a touch device leaves it —
       so a phone gets the scroll and idle terms and nothing else. */
    const ease = Math.min(1, step * 4);
    aimX.current += (state.pointer.x - aimX.current) * ease;
    aimY.current += (state.pointer.y - aimY.current) * ease;

    const t = state.clock.elapsedTime;
    const s = scroll.current;

    group.current.rotation.y = t * 0.18 + s * Math.PI * 1.2 + aimX.current * POINTER_YAW;
    group.current.rotation.x = Math.sin(t * 0.25) * 0.12 + s * 0.5 - aimY.current * POINTER_PITCH;

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
    group.current.scale.setScalar(1 + swell.current * 0.05);

    // The shell counter-rotates so the two layers shear against each other;
    // rotating together would read as one solid object.
    shell.current.rotation.y = -t * 0.32;
    shell.current.rotation.z = t * 0.1;
  });

  /* Geometry args are memoised: a fresh array literal in JSX makes R3F dispose
     and rebuild the geometry on every render. */
  const coreArgs = useMemo(() => [1.35, 1] as [number, number], []);
  const shellArgs = useMemo(() => [1.85, 1] as [number, number], []);

  return (
    /* No R3F pointer handlers. Fiber copies every enumerable field of the native
       event, and Firefox logs mozPressure / mozInputSource plus a file:// security
       error for that copy. Hover is a DOM listener on the canvas instead. */
    <group ref={group}>
      <mesh ref={core}>
        <icosahedronGeometry args={coreArgs} />
        {/* flatShading is what makes the facets legible — with smooth normals an
            icosahedron reads as a slightly lumpy sphere. */}
        <meshStandardMaterial
          color={BRAND_400}
          emissive={BRAND_600}
          emissiveIntensity={0.45}
          roughness={0.28}
          metalness={0.55}
          flatShading
        />
      </mesh>

      <mesh ref={shell}>
        <icosahedronGeometry args={shellArgs} />
        <meshBasicMaterial color={BRAND_200} wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/**
 * Static variant for `prefers-reduced-motion`. Same geometry and lighting, no
 * `useFrame` — the render loop never starts, so there is no motion to freeze
 * mid-frame and no per-frame cost.
 *
 * A scroll-driven 3D scene is exactly the content that triggers vestibular
 * symptoms, so this is a hard requirement rather than a nicety.
 */
function StaticEmblem() {
  return (
    <group rotation={[0.35, 0.6, 0]}>
      <mesh>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshStandardMaterial
          color={BRAND_400}
          emissive={BRAND_600}
          emissiveIntensity={0.45}
          roughness={0.28}
          metalness={0.55}
          flatShading
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.85, 1]} />
        <meshBasicMaterial color={BRAND_200} wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/**
 * Three logs "Context Lost" from its own listener, and Fiber then calls
 * `forceContextLoss` on unmount, which makes Firefox print the same loss again.
 * A real GPU drop still reaches `onLost` while the canvas is on the page.
 */
function createRenderer(canvas: HTMLCanvasElement, antialias: boolean, onLost: () => void) {
  const params: WebGLRendererParameters = {
    canvas,
    alpha: true,
    antialias,
    powerPreference: "low-power",
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
    return renderer;
  } finally {
    canvas.addEventListener = nativeAdd;
  }
}

export default function BeyondCoreScene({
  animate,
  highDpr,
  onContextLost,
}: {
  /** false under `prefers-reduced-motion` — renders one frame and stops. */
  animate: boolean;
  /** false on small viewports; caps the pixel ratio to keep phones cool. */
  highDpr: boolean;
  /** The GPU dropped the live context. The parent swaps in the 2D mockup. */
  onContextLost: () => void;
}) {
  const onLost = useRef(onContextLost);
  onLost.current = onContextLost;
  const over = useRef(false);

  return (
    <Canvas
      /* `frameloop: demand` renders exactly one frame and then only on request.
         Combined with the static emblem this is what makes reduced-motion free
         rather than merely still. */
      frameloop={animate ? "always" : "demand"}
      dpr={highDpr ? [1, 2] : [1, 1.5]}
      shadows={false}
      camera={{ position: [0, 0, 5], fov: 42 }}
      /* The page is white and the emblem is deep blue, so the canvas stays
         transparent and the hero's own background shows through. */
      gl={(defaults) => {
        const canvas = defaults.canvas;
        if (!(canvas instanceof HTMLCanvasElement)) {
          return new WebGLRenderer({
            alpha: true,
            antialias: highDpr,
            powerPreference: "low-power",
          });
        }
        return createRenderer(canvas, highDpr, () => onLost.current());
      }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl: renderer }) => {
        const el = renderer.domElement;
        const enter = () => {
          over.current = true;
        };
        const leave = () => {
          over.current = false;
        };
        el.addEventListener("pointerenter", enter);
        el.addEventListener("pointerleave", leave);
      }}
    >
      {/* Two point lights plus a dim ambient: the ambient stops the unlit faces
          going pure black, which on a white page looks like a hole. */}
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 5]} intensity={55} color="#ffffff" distance={18} />
      <pointLight position={[-4, -2, 3]} intensity={30} color={BRAND_200} distance={16} />
      {animate ? <Emblem over={over} /> : <StaticEmblem />}
    </Canvas>
  );
}
