import type { Section } from "./sat";

export type MockModuleId = "rw1" | "rw2" | "math1" | "math2";
export type MockPhase = MockModuleId | "break";

export type MockModuleMeta = {
  section: Section;
  module: 1 | 2;
  question_ids: string[];
};

export type MockSchedule = {
  breakSeconds: number;
  seconds: Record<MockModuleId, number>;
  indices: Record<MockModuleId, number[]>;
};

const MODULE_ORDER: MockModuleId[] = ["rw1", "rw2", "math1", "math2"];

export function isMockModule(phase: MockPhase): phase is MockModuleId {
  return phase !== "break";
}

export function mockPhaseOrder(schedule: MockSchedule): MockPhase[] {
  const hasRw = schedule.indices.rw1.length + schedule.indices.rw2.length > 0;
  const hasMath = schedule.indices.math1.length + schedule.indices.math2.length > 0;
  const out: MockPhase[] = [];
  if (schedule.indices.rw1.length) out.push("rw1");
  if (schedule.indices.rw2.length) out.push("rw2");
  if (hasRw && hasMath && schedule.breakSeconds > 0) out.push("break");
  if (schedule.indices.math1.length) out.push("math1");
  if (schedule.indices.math2.length) out.push("math2");
  return out;
}

export function phaseLabel(phase: MockPhase): string {
  switch (phase) {
    case "rw1":
      return "Reading and Writing · Module 1";
    case "rw2":
      return "Reading and Writing · Module 2";
    case "math1":
      return "Math · Module 1";
    case "math2":
      return "Math · Module 2";
    case "break":
      return "Break";
  }
}

export function phaseSeconds(schedule: MockSchedule, phase: MockPhase): number {
  if (phase === "break") return schedule.breakSeconds;
  return schedule.seconds[phase] ?? 0;
}

export function nextPhase(order: MockPhase[], current: MockPhase): MockPhase | null {
  const i = order.indexOf(current);
  if (i < 0 || i >= order.length - 1) return null;
  return order[i + 1] ?? null;
}

export function moduleKey(section: string, module: number): MockModuleId {
  if (section === "math") return module === 2 ? "math2" : "math1";
  return module === 2 ? "rw2" : "rw1";
}

export function sortMockModules(modules: MockModuleMeta[]): MockModuleMeta[] {
  const rank = (m: MockModuleMeta) =>
    (m.section === "reading_writing" ? 0 : 2) + (m.module === 2 ? 1 : 0);
  return [...modules].sort((a, b) => rank(a) - rank(b));
}

export function readMockPhase(meta: Record<string, unknown> | undefined): MockPhase | null {
  const p = meta?.mock_phase;
  if (p === "rw1" || p === "rw2" || p === "math1" || p === "math2" || p === "break") return p;
  if (p === "rw") return "rw1";
  if (p === "math") return "math1";
  return null;
}

export function emptyModuleIndices(): Record<MockModuleId, number[]> {
  return { rw1: [], rw2: [], math1: [], math2: [] };
}

/** Sessions started before per-module clocks: one RW clock and one Math clock. */
export function fallbackScheduleFromSections(
  questions: { section: string }[],
  rwSeconds: number,
  mathSeconds: number,
  breakSeconds: number,
): MockSchedule {
  const indices = emptyModuleIndices();
  questions.forEach((q, i) => {
    if (q.section === "math") indices.math1.push(i);
    else indices.rw1.push(i);
  });
  return {
    breakSeconds,
    seconds: { rw1: rwSeconds, rw2: 0, math1: mathSeconds, math2: 0 },
    indices,
  };
}

export function scheduleFromModules(
  questions: { id: string; section: string }[],
  modules: MockModuleMeta[],
  times: { rw1: number; rw2: number; math1: number; math2: number; breakSeconds: number },
): MockSchedule {
  const indexById = new Map(questions.map((q, i) => [q.id, i]));
  const indices = emptyModuleIndices();
  const claimed = new Set<number>();
  for (const m of sortMockModules(modules)) {
    const key = moduleKey(m.section, m.module);
    for (const id of m.question_ids) {
      const i = indexById.get(id);
      if (i == null || claimed.has(i)) continue;
      indices[key].push(i);
      claimed.add(i);
    }
  }
  questions.forEach((q, i) => {
    if (claimed.has(i)) return;
    indices[q.section === "math" ? "math1" : "rw1"].push(i);
  });
  return {
    breakSeconds: times.breakSeconds,
    seconds: {
      rw1: times.rw1,
      rw2: times.rw2,
      math1: times.math1,
      math2: times.math2,
    },
    indices,
  };
}

export function lockedIndicesForPhase(schedule: MockSchedule, phase: MockPhase): number[] {
  if (phase === "break") return MODULE_ORDER.flatMap((k) => schedule.indices[k]);
  return MODULE_ORDER.filter((k) => k !== phase).flatMap((k) => schedule.indices[k]);
}
