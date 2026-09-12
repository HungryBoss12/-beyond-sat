import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

/**
 * Welcome-screen emblem — same brand icosahedron as the landing hero, without
 * scroll-driven motion. Lazy-loaded only from WelcomeEmblem.tsx so three stays
 * out of the Beyond AI SSR graph.
 */

const BRAND_400 = "#535291";
const BRAND_600 = "#0b0761";
const BRAND_200 = "#9f9fc2";

const POINTER_YAW = 0.38;
const POINTER_PITCH = 0.26;

function Emblem() {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const shell = useRef<Mesh>(null);
  const aimX = useRef(0);
  const aimY = useRef(0);
  const hover = useRef(false);
  const swell = useRef(0);

  useFrame((state, delta) => {
    if (!group.current || !core.current || !shell.current) return;
    const step = Math.min(delta, 0.05);
    const ease = Math.min(1, step * 4);
    aimX.current += (state.pointer.x - aimX.current) * ease;
    aimY.current += (state.pointer.y - aimY.current) * ease;

    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.22 + aimX.current * POINTER_YAW;
    group.current.rotation.x = Math.sin(t * 0.28) * 0.14 - aimY.current * POINTER_PITCH;
    group.current.position.y = Math.sin(t * 0.55) * 0.06;
    group.current.position.x = aimX.current * 0.08;

    swell.current += ((hover.current ? 1 : 0) - swell.current) * Math.min(1, step * 5);
    group.current.scale.setScalar(1 + swell.current * 0.06);

    shell.current.rotation.y = -t * 0.34;
    shell.current.rotation.z = t * 0.12;
  });

  const coreArgs = useMemo(() => [1.35, 1] as [number, number], []);
  const shellArgs = useMemo(() => [1.85, 1] as [number, number], []);

  return (
    <group
      ref={group}
      onPointerOver={() => {
        hover.current = true;
      }}
      onPointerOut={() => {
        hover.current = false;
      }}
    >
      <mesh ref={core}>
        <icosahedronGeometry args={coreArgs} />
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

export default function WelcomeEmblemScene({
  animate,
  highDpr,
}: {
  animate: boolean;
  highDpr: boolean;
}) {
  return (
    <Canvas
      frameloop={animate ? "always" : "demand"}
      dpr={highDpr ? [1, 2] : [1, 1.5]}
      shadows={false}
      camera={{ position: [0, 0, 5], fov: 42 }}
      gl={{ antialias: highDpr, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 5]} intensity={55} color="#ffffff" distance={18} />
      <pointLight position={[-4, -2, 3]} intensity={30} color={BRAND_200} distance={16} />
      {animate ? <Emblem /> : <StaticEmblem />}
    </Canvas>
  );
}
