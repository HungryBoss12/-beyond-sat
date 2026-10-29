export type BadgeTier = "spectrum" | "gold" | "perfect";

export type BadgePaint = {
  color: string;
  ink: string;
  tier: BadgeTier;
};

/** 400 is purple, rising through blue to gold at 1500. Above that is yellow, and 1600 is red. */
export function badgePaint(score: number): BadgePaint {
  if (score >= 1600) return { color: "#e11d48", ink: "#fff", tier: "perfect" };
  if (score > 1500) return { color: "#f5c518", ink: "#1a1400", tier: "gold" };
  const t = Math.min(1, Math.max(0, (score - 400) / (1500 - 400)));
  const hue = t < 0.45 ? 280 + (230 - 280) * (t / 0.45) : 230 + (48 - 230) * ((t - 0.45) / 0.55);
  return { color: `hsl(${hue} 78% 56%)`, ink: "#fff", tier: "spectrum" };
}
