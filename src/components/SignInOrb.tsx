import { useEffect, useState } from "react";
import { BeyondCore } from "@/components/landing/BeyondCore";
import { LOOKS } from "@/components/landing/beyond-core-looks";

const CYCLE_MS = 20_000;

export function SignInOrb({ className = "" }: { className?: string }) {
  const [variant, setVariant] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(
      () => setVariant((current) => (current + 1) % LOOKS.length),
      CYCLE_MS,
    );
    return () => window.clearInterval(id);
  }, [variant]);

  return (
    <div className={className}>
      <BeyondCore interactive allowNarrow lite variant={variant} />
    </div>
  );
}
