import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListSkeleton } from "@/components/ui/skeletons";
import {
  rankMockAttempts,
  recentMockRatings,
  studentLabel,
  type PlaceGroup,
  type RecentMock,
} from "@/lib/admin/mock-standings";

export const Route = createFileRoute("/_authenticated/admin/statistics")({
  component: AdminStatistics,
  head: () => ({ meta: [{ title: "Statistics — Admin — BeyondSAT" }] }),
});

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
};

const STEP_ORDER = [2, 1, 3] as const;

const ROMAN_GLYPHS: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function roman(value: number): string {
  let rest = value;
  let out = "";
  for (const [amount, glyph] of ROMAN_GLYPHS) {
    while (rest >= amount) {
      out += glyph;
      rest -= amount;
    }
  }
  return out;
}

/** One bold bar above the numeral and one below, with a gap so they never touch it. */
function RomanMark({
  value,
  barClassName,
  textClassName,
  textStyle,
}: {
  value: string;
  barClassName: string;
  textClassName?: string;
  textStyle?: React.CSSProperties;
}) {
  const bar = (
    <span
      className={"block rounded-full bg-current " + barClassName}
      style={{ width: `${Math.max(1.35, value.length * 0.72)}em` }}
      aria-hidden
    />
  );
  return (
    <span className="inline-flex w-max max-w-full flex-col items-center gap-[0.18em]">
      {bar}
      <span className={"text-center leading-none " + (textClassName ?? "")} style={textStyle}>
        {value}
      </span>
      {bar}
    </span>
  );
}

const ENGRAVED_SIZE: Record<1 | 2 | 3, string> = {
  1: "text-6xl",
  2: "text-5xl",
  3: "text-4xl",
};

type Metal = {
  leaf: string;
  disc: string;
  face: string;
  glow: string;
  aura: string;
  ink: string;
  numeral: string;
  pill: string;
  height: string;
};

const METAL: Record<1 | 2 | 3, Metal> = {
  1: {
    leaf: "#e3b93c",
    disc: "radial-gradient(circle at 35% 28%,#fffbe0 0%,#f3d160 45%,#c8941c 100%)",
    face: "linear-gradient(180deg,#fff0ad 0%,#e5b93a 55%,#b88612 100%)",
    glow: "rgba(255,205,70,0.55)",
    aura: "rgba(255,200,60,0.55)",
    ink: "#3d2e04",
    numeral: "linear-gradient(180deg,rgba(255,226,130,0.55),rgba(255,226,130,0.04))",
    pill: "linear-gradient(180deg,#fff0ad,#e0b034)",
    height: "14rem",
  },
  2: {
    leaf: "#b7c1d3",
    disc: "radial-gradient(circle at 35% 28%,#ffffff 0%,#dfe5ee 50%,#9aa6ba 100%)",
    face: "linear-gradient(180deg,#f7f9fc 0%,#c3cbd9 55%,#8c98ad 100%)",
    glow: "rgba(190,205,235,0.5)",
    aura: "rgba(185,200,230,0.45)",
    ink: "#2c3340",
    numeral: "linear-gradient(180deg,rgba(220,230,248,0.5),rgba(220,230,248,0.04))",
    pill: "linear-gradient(180deg,#ffffff,#bcc6d6)",
    height: "11rem",
  },
  3: {
    leaf: "#d68a46",
    disc: "radial-gradient(circle at 35% 28%,#ffe9cf 0%,#eaa766 50%,#b46a2a 100%)",
    face: "linear-gradient(180deg,#ffd7a6 0%,#d98a45 55%,#a35d22 100%)",
    glow: "rgba(235,150,80,0.5)",
    aura: "rgba(235,145,75,0.45)",
    ink: "#3d2208",
    numeral: "linear-gradient(180deg,rgba(255,190,130,0.5),rgba(255,190,130,0.04))",
    pill: "linear-gradient(180deg,#ffd7a6,#d58640)",
    height: "8.75rem",
  },
};

const SPARKS = [
  { left: "8%", top: "22%", delay: "0s", size: 3 },
  { left: "17%", top: "58%", delay: "0.9s", size: 2 },
  { left: "29%", top: "12%", delay: "1.6s", size: 2 },
  { left: "41%", top: "30%", delay: "0.4s", size: 3 },
  { left: "58%", top: "16%", delay: "1.2s", size: 2 },
  { left: "69%", top: "42%", delay: "2s", size: 3 },
  { left: "82%", top: "20%", delay: "0.7s", size: 2 },
  { left: "91%", top: "52%", delay: "1.8s", size: 3 },
];

function AdminStatistics() {
  const [recent, setRecent] = useState<RecentMock[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const exams = await supabase.from("mock_exams").select("id, title");
        const sessions = await fetchFinishedMocks();
        if (cancelled) return;
        if (exams.error) {
          setLoadError(exams.error.message);
          setRecent([]);
          return;
        }
        const titles = new Map((exams.data ?? []).map((exam) => [exam.id, exam.title]));
        const ratings = recentMockRatings(titles, sessions);
        setRecent(ratings);
        setSelectedId((current) => current ?? ratings[0]?.mockId ?? null);
      } catch (error) {
        if (cancelled) return;
        setRecent([]);
        setLoadError(error instanceof Error ? error.message : "Could not load mocks");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPlaces([]);
      return;
    }
    let cancelled = false;
    setPlaces(null);
    (async () => {
      try {
        const rows = await fetchMockSessions(selectedId);
        const ids = [...new Set(rows.map((row) => row.user_id))];
        const profiles = await fetchProfiles(ids);
        if (cancelled) return;
        const byId = new Map(profiles.map((profile) => [profile.id, profile]));
        setPlaces(
          rankMockAttempts(
            rows.map((row) => ({
              userId: row.user_id,
              score: row.score,
              rwScore: row.rw_score,
              mathScore: row.math_score,
              completedAt: row.completed_at,
            })),
            (userId) => studentLabel(byId.get(userId)),
          ),
        );
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setPlaces([]);
        setLoadError(error instanceof Error ? error.message : "Could not load results");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = recent?.find((mock) => mock.mockId === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="rise-in">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Statistics</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a full mock to see who finished it, ranked by total score.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {loadError}
        </p>
      ) : null}

      {recent === null ? (
        <ListSkeleton rows={4} />
      ) : recent.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-panel">
          No finished full mocks yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recent.map((mock) => {
            const on = mock.mockId === selectedId;
            return (
              <button
                key={mock.mockId}
                type="button"
                onClick={() => setSelectedId(mock.mockId)}
                className={
                  "tap rounded-2xl border px-4 py-3 text-left shadow-panel " +
                  (on
                    ? "border-brand-400 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:border-brand-400/50")
                }
              >
                <div className="truncate text-sm font-black">{mock.title}</div>
                <div
                  className={`mt-1 text-xs font-semibold ${on ? "text-brand-100" : "text-slate-500"}`}
                >
                  {mock.finisherCount} finished · top {mock.topScore}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <section className="rise-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-black text-slate-900">{selected.title}</h3>
            <p className="text-xs font-semibold text-slate-500">
              Best completed attempt per student.
            </p>
          </div>
          {places === null ? (
            <div className="p-6">
              <ListSkeleton rows={3} />
            </div>
          ) : (
            <>
              <Podium places={places} />
              <StandingList places={places} />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Podium({ places }: { places: PlaceGroup[] }) {
  return (
    <div
      className="relative overflow-hidden px-4 pt-12"
      style={{
        background:
          "radial-gradient(ellipse 55% 75% at 50% -5%,rgba(255,214,110,0.32),transparent 70%)," +
          "radial-gradient(ellipse 80% 50% at 50% 100%,rgba(83,82,145,0.55),transparent 75%)," +
          "linear-gradient(180deg,#171766 0%,#0d0d4c 55%,#06062b 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {SPARKS.map((spark, i) => (
          <span
            key={i}
            className="podium-twinkle absolute rounded-full bg-white"
            style={{
              left: spark.left,
              top: spark.top,
              width: spark.size,
              height: spark.size,
              animationDelay: spark.delay,
              boxShadow: "0 0 8px 2px rgba(255,236,170,0.8)",
            }}
          />
        ))}
      </div>
      <div className="relative mx-auto flex max-w-3xl items-end justify-center gap-3 sm:gap-5">
        {STEP_ORDER.map((place) => (
          <PodiumStep
            key={place}
            place={place}
            group={places.find((group) => group.place === place)}
          />
        ))}
      </div>
      <div
        className="relative mx-auto h-5 max-w-3xl"
        style={{
          background:
            "linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.04) 40%,transparent)",
          borderTop: "1px solid rgba(255,255,255,0.35)",
        }}
        aria-hidden
      />
    </div>
  );
}

function PodiumStep({ place, group }: { place: 1 | 2 | 3; group: PlaceGroup | undefined }) {
  const metal = METAL[place];
  const people = group?.people ?? [];
  const empty = people.length === 0;
  return (
    <div className="flex w-[31%] max-w-[14.5rem] flex-col items-center">
      <div className="relative">
        {!empty && (
          <div
            className="podium-aura pointer-events-none absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{ background: metal.aura }}
            aria-hidden
          />
        )}
        <div className={empty ? "opacity-40 grayscale" : ""}>
          <Wreath place={place} leaf={metal.leaf} disc={metal.disc} ink={metal.ink} />
        </div>
      </div>
      <div className="mt-2 min-h-[4.25rem] w-full text-center">
        {empty ? (
          <p className="pt-2 text-xs font-semibold text-white/50">No result</p>
        ) : (
          <>
            {people.map((person) => (
              <p
                key={person.userId}
                className="text-sm font-black leading-tight text-white [overflow-wrap:anywhere]"
                style={{ textShadow: `0 0 14px ${metal.glow}` }}
              >
                {person.name}
              </p>
            ))}
            <span
              className="mt-1.5 inline-block rounded-full px-3 py-0.5 text-xs font-black"
              style={{
                background: metal.pill,
                color: metal.ink,
                boxShadow: `0 0 16px ${metal.glow}`,
              }}
            >
              {people[0]?.score}
            </span>
          </>
        )}
      </div>
      <div
        className={
          "relative mt-2 w-full overflow-hidden rounded-t-2xl " + (empty ? "opacity-40" : "")
        }
        style={{
          height: metal.height,
          background:
            "linear-gradient(90deg,rgba(255,255,255,0.09),transparent 28%,transparent 72%,rgba(0,0,0,0.3))," +
            "linear-gradient(180deg,#232352 0%,#12122e 100%)",
          boxShadow: empty
            ? "none"
            : `0 0 44px -4px ${metal.glow}, inset 0 1px 0 rgba(255,255,255,0.65)`,
        }}
      >
        <div
          className="relative h-5"
          style={{ background: metal.face, boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.25)" }}
        >
          <div className="absolute inset-x-3 top-1 h-1 rounded-full bg-white/60 blur-[1px]" />
        </div>
        <div
          className="absolute inset-x-0 top-5 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${metal.glow},transparent)` }}
        />
        <div
          className={
            "pointer-events-none absolute inset-x-2 top-7 bottom-1 grid place-items-center font-black leading-none tracking-tight " +
            ENGRAVED_SIZE[place]
          }
          aria-hidden
        >
          <RomanMark
            value={roman(place)}
            barClassName="h-1 text-white/70"
            textClassName="text-center"
            textStyle={{
              backgroundImage: metal.numeral,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          />
        </div>
        {!empty && (
          <div className="podium-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        )}
      </div>
    </div>
  );
}

const WREATH_CENTER = 48;
const WREATH_RADIUS = 36;

/** Leaf pairs along the left half of a circle, from the bottom up to near the top. */
const LAUREL_LEAVES = Array.from({ length: 8 }, (_, i) => {
  const angle = ((18 + i * 17.5) * Math.PI) / 180;
  const x = WREATH_CENTER - WREATH_RADIUS * Math.sin(angle);
  const y = WREATH_CENTER + WREATH_RADIUS * Math.cos(angle);
  const tangent = (Math.atan2(-Math.sin(angle), -Math.cos(angle)) * 180) / Math.PI;
  const scale = 1 - i * 0.045;
  return { x, y, tangent, scale };
});

function LaurelBranch() {
  const start = (18 * Math.PI) / 180;
  const end = (150 * Math.PI) / 180;
  const sx = WREATH_CENTER - WREATH_RADIUS * Math.sin(start);
  const sy = WREATH_CENTER + WREATH_RADIUS * Math.cos(start);
  const ex = WREATH_CENTER - WREATH_RADIUS * Math.sin(end);
  const ey = WREATH_CENTER + WREATH_RADIUS * Math.cos(end);
  return (
    <>
      <path
        d={`M${sx.toFixed(2)} ${sy.toFixed(2)} A${WREATH_RADIUS} ${WREATH_RADIUS} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {LAUREL_LEAVES.map((leafPos, i) => (
        <g key={i} transform={`translate(${leafPos.x.toFixed(2)} ${leafPos.y.toFixed(2)})`}>
          <ellipse
            rx={7 * leafPos.scale}
            ry={2.8 * leafPos.scale}
            cx={0}
            cy={-3}
            transform={`rotate(${(leafPos.tangent - 38).toFixed(1)})`}
            stroke="none"
          />
          <ellipse
            rx={7 * leafPos.scale}
            ry={2.8 * leafPos.scale}
            cx={0}
            cy={3}
            transform={`rotate(${(leafPos.tangent + 38).toFixed(1)})`}
            stroke="none"
          />
        </g>
      ))}
    </>
  );
}

function Wreath({
  place,
  leaf,
  disc,
  ink,
}: {
  place: 1 | 2 | 3;
  leaf: string;
  disc: string;
  ink: string;
}) {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <svg viewBox="0 0 96 96" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill={leaf} stroke={leaf}>
          <LaurelBranch />
          <g transform="translate(96 0) scale(-1 1)">
            <LaurelBranch />
          </g>
        </g>
      </svg>
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-xl font-black tracking-tight shadow-md"
        style={{ background: disc, color: ink }}
      >
        <RomanMark value={roman(place)} barClassName="h-0.5" />
      </div>
    </div>
  );
}

function StandingList({ places }: { places: PlaceGroup[] }) {
  if (places.length === 0) {
    return <p className="px-5 pb-6 text-sm text-slate-500">No scored finishes for this mock.</p>;
  }
  return (
    <ol className="divide-y divide-slate-100 border-t border-slate-100">
      {places.flatMap((group) =>
        group.people.map((person) => (
          <li key={person.userId} className="flex items-center gap-3 px-5 py-3">
            <span className="grid min-h-8 min-w-8 shrink-0 place-items-center rounded-full bg-slate-100 px-1.5 py-1 text-xs font-black tracking-tight text-slate-700">
              <RomanMark value={roman(group.place)} barClassName="h-0.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-900">{person.name}</div>
              <div className="text-xs text-slate-500">
                R&W {person.rwScore ?? "—"} · Math {person.mathScore ?? "—"}
              </div>
            </div>
            <div className="text-sm font-black text-slate-900">{person.score}</div>
          </li>
        )),
      )}
    </ol>
  );
}

async function fetchFinishedMocks() {
  const pageSize = 1000;
  const all: {
    mockId: string;
    userId: string;
    score: number | null;
    completedAt: string | null;
  }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("test_sessions")
      .select("mock_exam_id, user_id, score, completed_at")
      .eq("type", "mock")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.mock_exam_id) continue;
      all.push({
        mockId: row.mock_exam_id,
        userId: row.user_id,
        score: row.score,
        completedAt: row.completed_at,
      });
    }
    if ((data ?? []).length < pageSize) break;
  }
  return all;
}

async function fetchMockSessions(mockId: string) {
  const pageSize = 1000;
  const all: {
    user_id: string;
    score: number | null;
    rw_score: number | null;
    math_score: number | null;
    completed_at: string | null;
  }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("test_sessions")
      .select("user_id, score, rw_score, math_score, completed_at")
      .eq("type", "mock")
      .eq("mock_exam_id", mockId)
      .not("completed_at", "is", null)
      .order("user_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

async function fetchProfiles(ids: string[]): Promise<ProfileRow[]> {
  const profiles: ProfileRow[] = [];
  for (let index = 0; index < ids.length; index += 80) {
    const slice = ids.slice(index, index + 80);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", slice);
    if (error) throw error;
    profiles.push(...((data ?? []) as ProfileRow[]));
  }
  return profiles;
}
