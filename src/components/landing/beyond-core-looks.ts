export type OrbShape = "ico" | "dodeca" | "octa" | "tetra";

export type OrbLook = {
  shape: OrbShape;
  detail: number;
  radius: number;
  core: string;
  emissive: string;
  shell: string;
};

/**
 * Looks the emblem can take. Index 0 is the hero. The rest are the Hall of Fame and the sign-in cycle.
 * Nothing here is red or magenta: the old rose look eased through red on its way in.
 */
export const LOOKS: readonly OrbLook[] = [
  { shape: "ico", detail: 1, radius: 1.35, core: "#535291", emissive: "#0b0761", shell: "#9f9fc2" },
  {
    shape: "dodeca",
    detail: 0,
    radius: 1.3,
    core: "#2f6fd6",
    emissive: "#0a2a8a",
    shell: "#9fc4f2",
  },
  { shape: "octa", detail: 0, radius: 1.5, core: "#7a4fc4", emissive: "#2a0b6b", shell: "#c6a6ee" },
  { shape: "ico", detail: 0, radius: 1.4, core: "#1f8c9e", emissive: "#06404f", shell: "#9fdce3" },
  {
    shape: "tetra",
    detail: 0,
    radius: 1.55,
    core: "#3d3a86",
    emissive: "#0b0761",
    shell: "#b7b7d6",
  },
  {
    shape: "octa",
    detail: 1,
    radius: 1.25,
    core: "#6e6cb0",
    emissive: "#1a146e",
    shell: "#dedef0",
  },
  {
    shape: "dodeca",
    detail: 0,
    radius: 1.2,
    core: "#100e66",
    emissive: "#05032e",
    shell: "#9f9fc2",
  },
  {
    shape: "tetra",
    detail: 1,
    radius: 1.35,
    core: "#4c4a9a",
    emissive: "#221a78",
    shell: "#c8c8e4",
  },
  { shape: "ico", detail: 1, radius: 1.2, core: "#2a2878", emissive: "#0b0761", shell: "#8e8eb8" },
  {
    shape: "octa",
    detail: 0,
    radius: 1.35,
    core: "#5c4d98",
    emissive: "#241456",
    shell: "#c2b6e4",
  },
];

export function lookFor(variant: number): OrbLook {
  const count = LOOKS.length;
  return LOOKS[((Math.trunc(variant) % count) + count) % count];
}
