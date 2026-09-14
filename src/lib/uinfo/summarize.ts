import { callRpc, readEnv, readSupabaseConfig, type VerifiedUser } from "@/lib/server-env";
import { DEFAULT_MODELS } from "@/lib/ai/router";

const FLUSH_COUNT = 24;
const FLUSH_AGE_MS = 12 * 60 * 60 * 1000;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type LogRow = { id: string; k: string; d: string; created_at: string };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function restHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
}

export async function handleUinfoFlush(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const config = readSupabaseConfig(env);
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!config || !serviceKey) return json({ error: "Server is not configured" }, 500);

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sign in required" }, 401);

  const userRes = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: "Your session has expired." }, 401);
  const user = (await userRes.json()) as VerifiedUser;
  if (!user.id) return json({ error: "Your session has expired." }, 401);

  let targetId = user.id;
  try {
    const body = (await request.json()) as { userId?: string };
    if (body.userId && body.userId !== user.id) {
      const staff = await callRpc<boolean>(config, "bs_is_staff", token);
      if (!staff) return json({ error: "Forbidden" }, 403);
      targetId = body.userId;
    }
  } catch {
    /* empty body is fine */
  }

  const result = await flushUinfo(env, config.url, serviceKey, targetId);
  return json(result, 200);
}

export async function loadUinfoSummary(env: unknown, userId: string): Promise<string> {
  const url = readEnv(env, "SUPABASE_URL") ?? readEnv(env, "VITE_SUPABASE_URL");
  const key = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return "";
  const res = await fetch(
    `${url}/rest/v1/uinfo?user_id=eq.${encodeURIComponent(userId)}&select=summary`,
    { headers: restHeaders(key) },
  );
  if (!res.ok) return "";
  const rows = (await res.json()) as { summary?: string }[];
  return (rows[0]?.summary ?? "").trim();
}

async function flushUinfo(
  env: unknown,
  url: string,
  key: string,
  userId: string,
): Promise<{ flushed: boolean; pending: number }> {
  const logsRes = await fetch(
    `${url}/rest/v1/uinfo_log?user_id=eq.${encodeURIComponent(userId)}&select=id,k,d,created_at&order=created_at.asc`,
    { headers: restHeaders(key) },
  );
  if (!logsRes.ok) return { flushed: false, pending: 0 };
  const logs = (await logsRes.json()) as LogRow[];
  if (logs.length === 0) return { flushed: false, pending: 0 };

  const oldest = new Date(logs[0].created_at).getTime();
  const ripe = logs.length >= FLUSH_COUNT || Date.now() - oldest >= FLUSH_AGE_MS;
  if (!ripe) return { flushed: false, pending: logs.length };

  const prevRes = await fetch(
    `${url}/rest/v1/uinfo?user_id=eq.${encodeURIComponent(userId)}&select=summary`,
    { headers: restHeaders(key) },
  );
  const prev = prevRes.ok
    ? ((await prevRes.json()) as { summary?: string }[])[0]?.summary ?? ""
    : "";

  const lines = logs.map((row) => `${row.k}:${row.d || "-"}`).join(" ");
  const apiKey = readEnv(env, "OPENROUTER_API_KEY");
  let summary = prev;
  if (apiKey) {
    const written = await writeSummary(apiKey, prev, lines);
    if (written) summary = written;
  }
  if (!summary) {
    summary = `Recent activity codes: ${lines.slice(0, 400)}.`;
  }

  await fetch(`${url}/rest/v1/uinfo?on_conflict=user_id`, {
    method: "POST",
    headers: { ...restHeaders(key), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, summary, updated_at: new Date().toISOString() }),
  });

  const ids = logs.map((row) => row.id);
  await fetch(`${url}/rest/v1/uinfo_log?id=in.(${ids.join(",")})`, {
    method: "DELETE",
    headers: restHeaders(key),
  });

  return { flushed: true, pending: 0 };
}

async function writeSummary(apiKey: string, previous: string, events: string): Promise<string> {
  const model = DEFAULT_MODELS.quick;
  const prompt =
    "Merge the previous UInfo with these compact activity codes into 8–12 sentences. " +
    "SAT habits, strengths, weak spots, and recent study pattern only. " +
    "Do not quote the codes. Do not address the student.\n\n" +
    `Previous:\n${previous || "(none)"}\n\nCodes:\n${events}`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://beyondsat.app",
      "X-Title": "Beyond SAT",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
      stream: false,
    }),
  });
  if (!response.ok) return "";
  const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
