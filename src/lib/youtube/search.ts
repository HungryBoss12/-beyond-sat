import { readEnv, readSupabaseConfig, verifySupabaseUser, readBearerToken } from "@/lib/server-env";
import { loadUinfoSummary } from "@/lib/uinfo/summarize";

const CACHE_MS = 12 * 60 * 60 * 1000;
const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export type YoutubeRec = {
  title: string;
  url: string;
  channel: string;
  videoId: string;
  durationSeconds: number | null;
};

type CacheRow = {
  query: string;
  section: string | null;
  videos: YoutubeRec[];
  updated_at: string;
};

function isOpaqueSupabaseKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** PostgREST headers for the service role (or any server-side Supabase key). */
function restHeaders(key: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: key,
    "content-type": "application/json",
  };
  /* New opaque keys are not JWTs — sending `Authorization: Bearer sb_secret_…`
     makes PostgREST reject the call. Legacy `eyJ…` service_role JWTs still need Bearer. */
  if (!isOpaqueSupabaseKey(key)) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function latestUserText(messages: { role: string; content: unknown }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    if (!Array.isArray(message.content)) return "";
    return message.content
      .filter((part): part is { type: "text"; text: string } => {
        return (
          !!part &&
          typeof part === "object" &&
          (part as { type?: string }).type === "text" &&
          typeof (part as { text?: unknown }).text === "string"
        );
      })
      .map((part) => part.text)
      .join(" ");
  }
  return "";
}

/** `none` = skip YouTube API. `use` = cache or search. `refresh` = force a new search. */
export function videoIntent(text: string): "none" | "use" | "refresh" {
  const t = text.toLowerCase();
  const videoish =
    /\b(youtube|videos?|watch)\b/.test(t) ||
    (/\brecommend/.test(t) && /\b(video|lesson|watch|clip|youtube)\b/.test(t)) ||
    (/\blessons?\b/.test(t) && /\b(watch|video|youtube)\b/.test(t));
  if (!videoish) return "none";
  if (/\b(new|other|different|more|another|else|fresh)\b/.test(t)) return "refresh";
  return "use";
}

const SKILL_QUERIES: [RegExp, string][] = [
  [/\balgebra\b/, "Digital SAT algebra practice"],
  [/\bgeometry\b|\btrigonometr/, "Digital SAT geometry trigonometry"],
  [/\bdata analysis\b|\bstatistics\b/, "Digital SAT data analysis"],
  [/\badvanced math\b|\bquadratics?\b/, "Digital SAT advanced math"],
  [/\bgrammar\b|\bconventions\b/, "Digital SAT grammar writing"],
  [/\bvocabular|\bwords? in context\b/, "Digital SAT vocabulary in context"],
  [/\breading\b|\bcomprehension\b/, "Digital SAT reading comprehension"],
  [/\bwriting\b|\bexpression of ideas\b/, "Digital SAT writing and language"],
];

/** Section kind used to scope "For you" video recs. `null` = unscoped. */
export type YoutubeSection = "rw" | "math" | null;

export function parseYoutubeSection(value: string | null | undefined): YoutubeSection {
  const v = (value ?? "").toLowerCase();
  if (v === "rw" || v === "math") return v;
  return null;
}

// Section-pinned fallback queries (used when uinfo has no in-section skill hit).
const SECTION_FALLBACK: Exclude<YoutubeSection, null> extends never ? never : Record<"rw" | "math", string> = {
  rw: "Digital SAT reading writing grammar lesson",
  math: "Digital SAT math algebra practice lesson",
};

// Titles that betray an off-section video; used as a post-search safety net.
const CROSS_SECTION_DENY: Record<"rw" | "math", RegExp[]> = {
  rw: [/\balgebra\b/i, /\bgeometr/i, /\btrigonometr/i, /\bcalculus\b/i, /\b equation\b/i, /\bquadratic/i, /\bgraph/i],
  math: [/\bgrammar\b/i, /\breading comprehension\b/i, /\bvocabulary\b/i, /\bwriting\b(?! skills? strategies?)/i, /\bsat essay\b/i],
};

export function buildSearchQuery(uinfo: string, hint = "", section: YoutubeSection = null): string {
  const blob = `${hint}\n${uinfo}`.toLowerCase();
  if (section) {
    // In-section skill match first…
    for (const [re, query] of SKILL_QUERIES) {
      if (re.test(blob) && sectionAllows(section, query)) return query;
    }
    // …then pinned section query (never falls through to the other section).
    return SECTION_FALLBACK[section];
  }
  for (const [re, query] of SKILL_QUERIES) {
    if (re.test(blob)) return query;
  }
  return "Digital SAT practice lesson";
}

function sectionAllows(section: "rw" | "math", query: string): boolean {
  const q = query.toLowerCase();
  if (section === "math") return /algebra|geometry|trigonometry|data analysis|advanced math/.test(q);
  return /grammar|vocabulary|reading|writing/.test(q);
}

/** Drop videos whose title is clearly from the other section (safety net). */
export function filterCrossSection(videos: YoutubeRec[], section: YoutubeSection): YoutubeRec[] {
  if (!section) return videos;
  const deny = CROSS_SECTION_DENY[section];
  const kept = videos.filter((v) => !deny.some((re) => re.test(v.title)));
  // Keep at least one result even if the deny-list eats everything.
  return kept.length > 0 ? kept : videos.slice(0, 1);
}

export function formatYoutubePromptBlock(videos: YoutubeRec[]): string {
  if (videos.length === 0) return "";
  const lines = videos.map((video, i) => {
    const channel = video.channel ? ` (${video.channel})` : "";
    return `${i + 1}. ${video.title} — ${video.url}${channel}`;
  });
  return `YouTube picks (real URLs only; do not invent videos):\n${lines.join("\n")}`;
}

export function parseIsoDuration(iso: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!match) return null;
  const seconds =
    Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return seconds > 0 ? Math.round(seconds) : null;
}

const RETRYABLE_REASONS = new Set([
  "quotaExceeded",
  "rateLimitExceeded",
  "dailyLimitExceeded",
  "keyInvalid",
  "ipRefererBlocked",
]);

const MAX_RECS = 2;

/** Split a stored settings value into ordered, unique API keys. */
export function parseApiKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const key = part.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

async function readApiKeysFromSettings(url: string, serviceKey: string): Promise<string[]> {
  const res = await fetch(
    `${url}/rest/v1/app_settings?key=eq.youtube_data_api_key&select=value`,
    { headers: restHeaders(serviceKey) },
  );
  if (!res.ok) {
    console.error(`[youtube] app_settings read failed (${res.status})`);
    return [];
  }
  const rows = (await res.json()) as { value?: string | null }[];
  return parseApiKeys(rows[0]?.value);
}

/** Prefer Worker secrets, then Admin Settings (via service role). */
async function resolveApiKeys(env: unknown, url: string | undefined, serviceKey: string | undefined) {
  const fromEnv = parseApiKeys(
    readEnv(env, "YOUTUBE_DATA_API_KEYS") ?? readEnv(env, "YOUTUBE_DATA_API_KEY"),
  );
  if (fromEnv.length > 0) return fromEnv;
  if (!url || !serviceKey) {
    console.error(
      "[youtube] no YOUTUBE_DATA_API_KEY(S) secret and SUPABASE_SERVICE_ROLE_KEY/URL missing — cannot load Admin Settings keys",
    );
    return [];
  }
  const fromSettings = await readApiKeysFromSettings(url, serviceKey);
  if (fromSettings.length === 0) {
    console.error(
      "[youtube] Admin Settings youtube_data_api_key empty or unreadable with service role (RLS returns [] for anon)",
    );
  }
  return fromSettings;
}

type SearchOutcome =
  | { ok: true; videos: YoutubeRec[] }
  | { ok: false; retry: boolean; status: number; reason?: string };

function youtubeErrorReasons(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const errors = (body as { error?: { errors?: { reason?: string }[] } }).error?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.map((e) => e.reason).filter((r): r is string => typeof r === "string" && !!r);
}

function shouldRetryKey(status: number, reasons: string[]): boolean {
  if (status === 429) return true;
  if (status === 403) return true;
  return reasons.some((r) => RETRYABLE_REASONS.has(r));
}

async function readCache(
  url: string,
  serviceKey: string,
  userId: string,
  section: "rw" | "math" | null,
): Promise<CacheRow | null> {
  const parts = [`user_id=eq.${encodeURIComponent(userId)}`];
  // Explicit section match so a stale cross-section row can never leak.
  // '' (empty string) marks unscoped legacy/chat rows.
  parts.push(section ? `section=eq.${section}` : `section=eq.`);
  const res = await fetch(
    `${url}/rest/v1/youtube_rec_cache?${parts.join("&")}&select=query,section,videos,updated_at`,
    { headers: restHeaders(serviceKey) },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as {
    query?: string;
    section?: string | null;
    videos?: YoutubeRec[];
    updated_at?: string;
  }[];
  const row = rows[0];
  if (!row?.updated_at || !Array.isArray(row.videos)) return null;
  return {
    query: row.query ?? "",
    section: row.section ?? null,
    videos: row.videos,
    updated_at: row.updated_at,
  };
}

function cacheFresh(row: CacheRow | null, query?: string): YoutubeRec[] | null {
  if (!row) return null;
  const age = Date.now() - new Date(row.updated_at).getTime();
  if (age > CACHE_MS || Number.isNaN(age)) return null;
  if (query !== undefined && row.query !== query) return null;
  return row.videos;
}

async function writeCache(
  url: string,
  serviceKey: string,
  userId: string,
  section: "rw" | "math" | null,
  query: string,
  videos: YoutubeRec[],
): Promise<void> {
  await fetch(`${url}/rest/v1/youtube_rec_cache?on_conflict=user_id,section`, {
    method: "POST",
    headers: { ...restHeaders(serviceKey), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      section: section ?? "",
      query,
      videos,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function searchYoutube(apiKey: string, query: string): Promise<SearchOutcome> {
  const search = new URL(SEARCH_URL);
  search.searchParams.set("part", "snippet");
  search.searchParams.set("type", "video");
  search.searchParams.set("videoEmbeddable", "true");
  search.searchParams.set("maxResults", String(MAX_RECS));
  search.searchParams.set("relevanceLanguage", "en");
  search.searchParams.set("safeSearch", "strict");
  search.searchParams.set("q", query);
  search.searchParams.set("key", apiKey);

  const searchRes = await fetch(search.toString());
  const searchBody = (await searchRes.json().catch(() => null)) as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[];
    error?: unknown;
  } | null;

  if (!searchRes.ok) {
    const reasons = youtubeErrorReasons(searchBody);
    const retry = shouldRetryKey(searchRes.status, reasons);
    console.error(
      `[youtube] search.list ${searchRes.status}` +
        (reasons.length ? ` (${reasons.join(",")})` : "") +
        (retry ? " — will try next key" : ""),
    );
    return { ok: false, retry, status: searchRes.status, reason: reasons[0] };
  }

  const items = (searchBody?.items ?? [])
    .map((item) => ({
      videoId: item.id?.videoId ?? "",
      title: item.snippet?.title ?? "",
      channel: item.snippet?.channelTitle ?? "",
    }))
    .filter((item) => item.videoId && item.title)
    .slice(0, MAX_RECS);
  if (items.length === 0) return { ok: true, videos: [] };

  const durations = new Map<string, number | null>();
  const videosUrl = new URL(VIDEOS_URL);
  videosUrl.searchParams.set("part", "contentDetails");
  videosUrl.searchParams.set("id", items.map((item) => item.videoId).join(","));
  videosUrl.searchParams.set("key", apiKey);
  const videosRes = await fetch(videosUrl.toString());
  if (videosRes.ok) {
    const videosData = (await videosRes.json()) as {
      items?: { id?: string; contentDetails?: { duration?: string } }[];
    };
    for (const item of videosData.items ?? []) {
      if (item.id) durations.set(item.id, parseIsoDuration(item.contentDetails?.duration ?? ""));
    }
  }

  return {
    ok: true,
    videos: items.map((item) => ({
      title: item.title,
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
      channel: item.channel,
      videoId: item.videoId,
      durationSeconds: durations.get(item.videoId) ?? null,
    })),
  };
}

export async function loadYoutubeRecs(
  env: unknown,
  userId: string,
  uinfo: string,
  opts?: { refresh?: boolean; hint?: string; allowSearch?: boolean; section?: YoutubeSection },
): Promise<YoutubeRec[]> {
  const url = readEnv(env, "SUPABASE_URL") ?? readEnv(env, "VITE_SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const section = opts?.section ?? null;

  const query = buildSearchQuery(uinfo, opts?.hint ?? "", section);
  const cached = url && serviceKey ? await readCache(url, serviceKey, userId, section) : null;

  if (!opts?.refresh) {
    const exact = cacheFresh(cached, query);
    if (exact) return filterCrossSection(exact, section).slice(0, MAX_RECS);
    if (!opts?.allowSearch) return filterCrossSection(cacheFresh(cached) ?? [], section).slice(0, MAX_RECS);
  }

  const apiKeys = await resolveApiKeys(env, url, serviceKey);
  if (apiKeys.length === 0) return filterCrossSection(cacheFresh(cached) ?? [], section).slice(0, MAX_RECS);

  try {
    for (let i = 0; i < apiKeys.length; i++) {
      const outcome = await searchYoutube(apiKeys[i], query);
      if (!outcome.ok) {
        console.error(`[youtube] key #${i + 1} failed (${outcome.reason ?? outcome.status})`);
        if (outcome.retry) continue;
        break;
      }
      const videos = filterCrossSection(outcome.videos, section).slice(0, MAX_RECS);
      if (videos.length === 0) return filterCrossSection(cacheFresh(cached) ?? [], section).slice(0, MAX_RECS);
      if (url && serviceKey) {
        await writeCache(url, serviceKey, userId, section, query, videos);
      }
      return videos;
    }
    return filterCrossSection(cacheFresh(cached) ?? [], section).slice(0, MAX_RECS);
  } catch (error) {
    console.error("[youtube] search failed", error);
    return filterCrossSection(cacheFresh(cached) ?? [], section).slice(0, MAX_RECS);
  }
}

/** Warm cache only — never calls YouTube. */
export async function loadCachedYoutubeRecs(
  env: unknown,
  userId: string,
  section: YoutubeSection = null,
): Promise<YoutubeRec[]> {
  const url = readEnv(env, "SUPABASE_URL") ?? readEnv(env, "VITE_SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return [];
  const cached = await readCache(url, serviceKey, userId, section);
  return filterCrossSection(cacheFresh(cached) ?? [], section).slice(0, MAX_RECS);
}

export async function handleYoutubeRecs(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const config = readSupabaseConfig(env);
  if (!config) return json({ error: "Server is not configured" }, 500);

  const token = readBearerToken(request);
  if (!token) return json({ error: "Sign in required" }, 401);
  const user = await verifySupabaseUser(config, token);
  if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);

  try {
    const section = parseYoutubeSection(new URL(request.url).searchParams.get("section"));
    const uinfo = await loadUinfoSummary(env, user.id);
    const videos = await loadYoutubeRecs(env, user.id, uinfo, { allowSearch: true, section });
    return json({ videos }, 200);
  } catch (error) {
    console.error("[youtube] recs endpoint failed", error);
    return json({ videos: [] }, 200);
  }
}
