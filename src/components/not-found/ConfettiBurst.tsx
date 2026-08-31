import { useEffect, useState } from "react";

const COLORS = ["#535291", "#6E3AFF", "#100e66", "#ffffff", "#5B30D9", "#9f9fc2"];

type Particle = {
  id: number;
  left: string;
  top: string;
  color: string;
  rotate: number;
  delay: number;
};

function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${40 + Math.random() * 20}%`,
    top: `${35 + Math.random() * 20}%`,
    color: COLORS[i % COLORS.length]!,
    rotate: Math.random() * 360,
    delay: Math.random() * 0.08,
  }));
}

export function ConfettiBurst({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    setParticles(buildParticles(14));
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1300);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!visible || particles.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti-particle absolute block h-2 w-1.5 rounded-sm"
          style={{
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
