import { jsonResponse, requireAdmin } from "@/lib/vocab/rest";
import { hydrateServerEnv } from "@/lib/server-env";
import { accountEmailFor, slugUsernameFromName } from "./login-email";
import { isValidUsername, normalizeUsername } from "@/lib/classes/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVITE_DAYS = 14;

function splitName(name: string): { first_name: string; last_name: string | null; full_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] ?? name.trim();
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { first_name, last_name, full_name: name.trim() };
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function adminDb() {
  const { resetSupabaseAdmin, ensureSupabaseAdmin, supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  resetSupabaseAdmin();
  ensureSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabaseAdmin, db: supabaseAdmin as any };
}

async function issueInvite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  studentId: string,
  createdBy: string | null,
): Promise<string> {
  const now = new Date().toISOString();
  await db.from("student_invites").update({ used_at: now }).eq("student_id", studentId).is("used_at", null);
  const token = randomToken();
  const token_hash = await sha256Hex(token);
  const expires_at = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from("student_invites").insert({
    student_id: studentId,
    token_hash,
    expires_at,
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
  return token;
}

async function loadInvite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  token: string,
) {
  const token_hash = await sha256Hex(token.trim());
  const { data, error } = await db
    .from("student_invites")
    .select("id, student_id, expires_at, used_at, students(id, full_name, user_id, claimed_at)")
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data && Array.isArray((data as { students?: unknown }).students)) {
    const list = (data as { students: unknown[] }).students;
    (data as { students: unknown }).students = list[0] ?? null;
  }
  return data as {
    id: string;
    student_id: string;
    expires_at: string;
    used_at: string | null;
    students: { id: string; full_name: string; user_id: string | null; claimed_at: string | null } | null;
  } | null;
}

function inviteClosed(row: { expires_at: string; used_at: string | null; students: { claimed_at: string | null } | null }): string | null {
  if (!row.students) return "This link is not valid.";
  if (row.used_at || row.students.claimed_at) return "This link has already been used.";
  if (new Date(row.expires_at).getTime() < Date.now()) return "This link has expired. Ask your teacher for a new one.";
  return null;
}

export async function handlePreviewStudentInvite(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  hydrateServerEnv(env);
  let body: { token?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 20) return jsonResponse({ error: "This link is not valid." }, 404);
  try {
    const { db } = await adminDb();
    const row = await loadInvite(db, token);
    if (!row) return jsonResponse({ error: "This link is not valid." }, 404);
    const closed = inviteClosed(row);
    if (closed) return jsonResponse({ error: closed }, 410);
    const userId = row.students!.user_id;
    let username = "";
    if (userId) {
      const { data: prof } = await db.from("profiles").select("username").eq("id", userId).maybeSingle();
      username = (prof?.username as string | null) ?? "";
    }
    return jsonResponse({ name: row.students!.full_name, username });
  } catch (e) {
    console.error("[student-invite] preview", (e as Error).message);
    return jsonResponse({ error: "Could not open this link." }, 500);
  }
}

export async function handleClaimStudentInvite(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  hydrateServerEnv(env);
  let body: { token?: unknown; name?: unknown; username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  if (token.length < 20) return jsonResponse({ error: "This link is not valid." }, 404);
  if (name.length < 2) return jsonResponse({ error: "Enter your name." }, 400);
  if (!isValidUsername(username)) {
    return jsonResponse(
      { error: "Username must start with a letter and be 3–24 letters, numbers, or underscores." },
      400,
    );
  }
  if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  if (password.length > 72) return jsonResponse({ error: "Password is too long." }, 400);

  let releaseClaim: (() => Promise<unknown>) | null = null;
  try {
    const { supabaseAdmin, db } = await adminDb();
    const row = await loadInvite(db, token);
    if (!row) return jsonResponse({ error: "This link is not valid." }, 404);
    const closed = inviteClosed(row);
    if (closed) return jsonResponse({ error: closed }, 410);
    const userId = row.students!.user_id;
    if (!userId) return jsonResponse({ error: "This account is not ready yet." }, 500);

    const { data: taken } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
    if (taken && taken.id !== userId) {
      return jsonResponse({ error: "That username is already taken." }, 409);
    }

    const now = new Date().toISOString();
    const { data: claimed, error: claimErr } = await db
      .from("student_invites")
      .update({ used_at: now })
      .eq("id", row.id)
      .is("used_at", null)
      .select("id");
    if (claimErr) return jsonResponse({ error: claimErr.message }, 500);
    if (!claimed?.length) {
      return jsonResponse({ error: "This link has already been used." }, 410);
    }
    const release = () =>
      db.from("student_invites").update({ used_at: null }).eq("id", row.id).eq("used_at", now);
    releaseClaim = release;

    const email = accountEmailFor(username);
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email,
      email_confirm: true,
    });
    if (updErr) {
      await release();
      return jsonResponse({ error: updErr.message }, 400);
    }

    const { first_name, last_name, full_name } = splitName(name);
    const { error: profErr } = await db
      .from("profiles")
      .update({
        username,
        first_name,
        last_name,
        full_name,
        email,
        must_change_credentials: false,
        intro_completed: false,
      })
      .eq("id", userId);
    if (profErr) {
      await release();
      return jsonResponse({ error: profErr.message }, 500);
    }

    const { error: studentErr } = await db
      .from("students")
      .update({ full_name, claimed_at: now })
      .eq("id", row.student_id);
    if (studentErr) {
      await release();
      return jsonResponse({ error: studentErr.message }, 500);
    }

    return jsonResponse({ ok: true, username });
  } catch (e) {
    if (releaseClaim) await releaseClaim().catch(() => undefined);
    console.error("[student-invite] claim", (e as Error).message);
    return jsonResponse({ error: "Could not save your account." }, 500);
  }
}

export async function handleCreateStudentInvite(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  hydrateServerEnv(env);
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  let body: { name?: unknown; classId?: unknown; studentId?: unknown; userId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const classId = typeof body.classId === "string" ? body.classId.trim() : "";

  try {
    const { supabaseAdmin, db } = await adminDb();

    if (studentId || userId) {
      if (studentId && !UUID_RE.test(studentId)) return jsonResponse({ error: "Student not found." }, 404);
      if (userId && !UUID_RE.test(userId)) return jsonResponse({ error: "Student not found." }, 404);
      const query = db.from("students").select("id, full_name, user_id, claimed_at");
      const { data: student, error } = studentId
        ? await query.eq("id", studentId).maybeSingle()
        : await query.eq("user_id", userId).maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!student) return jsonResponse({ error: "No student record for this account." }, 404);
      if (student.claimed_at) return jsonResponse({ error: "This student has already registered." }, 409);
      const token = await issueInvite(db, student.id, auth.user.id);
      const { data: prof } = student.user_id
        ? await db.from("profiles").select("username").eq("id", student.user_id).maybeSingle()
        : { data: null };
      return jsonResponse({
        studentId: student.id,
        username: (prof?.username as string | null) ?? "",
        name: student.full_name,
        path: `/join/${token}`,
      });
    }

    if (name.length < 2) return jsonResponse({ error: "Enter the student's name." }, 400);
    if (classId && !UUID_RE.test(classId)) return jsonResponse({ error: "Pick a class first." }, 400);

    const { first_name, last_name, full_name } = splitName(name);
    const base = slugUsernameFromName(name);
    const { data: takenRows } = await db.from("profiles").select("username").ilike("username", `${base}%`);
    const taken = new Set(
      ((takenRows ?? []) as { username: string | null }[])
        .map((r) => (r.username ?? "").toLowerCase())
        .filter(Boolean),
    );
    let username = base;
    let n = 2;
    while (taken.has(username)) {
      const suffix = String(n++);
      username = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
    }
    const email = accountEmailFor(username);
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      app_metadata: { staff_created: true },
      user_metadata: { first_name, last_name, full_name, username },
    });
    if (createErr || !created.user) {
      return jsonResponse({ error: createErr?.message ?? "Could not create the account." }, 400);
    }
    const newUserId = created.user.id;
    for (let i = 0; i < 10; i++) {
      const { data: row } = await db.from("profiles").select("id").eq("id", newUserId).maybeSingle();
      if (row) break;
      await sleep(150);
    }
    const { error: profErr } = await db
      .from("profiles")
      .update({
        username,
        first_name,
        last_name,
        full_name,
        email,
        must_change_credentials: true,
        intro_completed: false,
        staff_created: true,
        chat_setup_completed: false,
      })
      .eq("id", newUserId);
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: profErr.message }, 500);
    }

    const { data: student, error: studentErr } = await db
      .from("students")
      .insert({ full_name, user_id: newUserId, created_by: auth.user.id })
      .select("id")
      .single();
    if (studentErr || !student) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: studentErr?.message ?? "Could not save the student." }, 500);
    }

    if (classId) {
      await db.from("class_memberships").delete().eq("user_id", newUserId);
      const { error: memErr } = await db.from("class_memberships").insert({ class_id: classId, user_id: newUserId });
      if (memErr) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return jsonResponse({ error: memErr.message }, 500);
      }
    }

    const token = await issueInvite(db, student.id, auth.user.id);
    return jsonResponse({
      studentId: student.id,
      username,
      name: full_name,
      path: `/join/${token}`,
    });
  } catch (e) {
    console.error("[student-invite] create", (e as Error).message);
    return jsonResponse({ error: (e as Error).message || "Could not create the link." }, 500);
  }
}
