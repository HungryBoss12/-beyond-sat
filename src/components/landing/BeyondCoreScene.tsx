import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Mesh, Group } from "three";

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
 * classes. They match --color-brand-* in styles.css: 200 #8a98d6, 400 #2e43c4,
 * 600 #11269d, 700 #0e1f82.
 */

const BRAND_400 = "#2e43c4";
const BRAND_600 = "#11269d";
const BRAND_200 = "#8a98d6";

/** Scroll progress through the hero, 0 → 1, clamped. */
function heroProgress() {
  if (typeof window === "undefined") return 0;
  // One viewport of scroll is the full sweep. Beyond that the hero is off-screen
  // and the value pins at 1, so the mesh settles rather than drifting forever.
  const denominator = window.innerHeight || 1;
  return Math.min(1, Math.max(0, window.scrollY / denominator));
}

/**
 * The emblem: a faceted core inside a slowly counter-rotating wireframe shell.
 *
 * Scroll drives rotation and depth; time drives a slow idle spin so the object
 * is alive before the visitor touches anything. Both are applied to the group's
 * transform rather than the camera — moving the camera would also move the
 * lights, which are what give the facets their definition.
 */
function Emblem() {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const shell = useRef<Mesh>(null);

  /* Smoothed scroll value. Reading window.scrollY straight into the transform
     makes the mesh jitter on trackpads, which emit many small deltas per frame;
     easing toward the target turns that into a glide. */
  const scroll = useRef(0);

  useFrame((state, delta) => {
    if (!group.current || !core.current || !shell.current) return;

    // delta is clamped because a backgrounded tab resumes with a huge delta,
    // which would snap the mesh a quarter turn in one frame.
    const step = Math.min(delta, 0.05);
    scroll.current += (heroProgress() - scroll.current) * Math.min(1, step * 6);

    const t = state.clock.elapsedTime;
    const s = scroll.current;

    group.current.rotation.y = t * 0.18 + s * Math.PI * 1.2;
    group.current.rotation.x = Math.sin(t * 0.25) * 0.12 + s * 0.5;

    // Recedes and shrinks as the page scrolls past — the parallax cue that ties
    // the object to the scroll position without moving the camera.
    const depth = s * -1.6;
    group.current.position.z = depth;
    group.current.position.y = Math.sin(t * 0.5) * 0.08 - s * 0.3;

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

export default function BeyondCoreScene({
  animate,
  highDpr,
}: {
  /** false under `prefers-reduced-motion` — renders one frame and stops. */
  animate: boolean;
  /** false on small viewports; caps the pixel ratio to keep phones cool. */
  highDpr: boolean;
}) {
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
      gl={{ antialias: highDpr, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Two point lights plus a dim ambient: the ambient stops the unlit faces
          going pure black, which on a white page looks like a hole. */}
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 5]} intensity={55} color="#ffffff" distance={18} />
      <pointLight position={[-4, -2, 3]} intensity={30} color={BRAND_200} distance={16} />
      {animate ? <Emblem /> : <StaticEmblem />}
    </Canvas>
  );
}
