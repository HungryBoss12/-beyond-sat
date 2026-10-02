/**
 * One-off: create SAT 14 if needed, then provisional accounts and rosters
 * from Total work.xlsx. Safe to run again: the same import key is not created twice.
 *
 * Writes invite links to scripts/output/student-invites.csv (gitignored).
 */
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://beyond-sat-v0.javazbek80.workers.dev";

function loadDevVars() {
  const path = resolve(root, ".dev.vars");
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = val;
  }
  return env;
}

function slugUsername(name) {
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  const withLetter = /^[a-z]/.test(cleaned) ? cleaned : `u${cleaned.replace(/^_+/, "")}`;
  const base = withLetter.length >= 3 ? withLetter : `user${withLetter}`;
  return base.slice(0, 24);
}

function splitName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? name.trim(),
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
    full_name: name.trim(),
  };
}

function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(24);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function newToken() {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

function tashkentToday() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadPeople() {
  const parsed = spawnSync("python", [resolve(root, "scripts/parse-total-work.py")], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (parsed.status !== 0) {
    console.error(parsed.stderr || parsed.stdout);
    process.exit(parsed.status || 1);
  }
  return JSON.parse(parsed.stdout);
}

async function main() {
  const env = loadDevVars();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .dev.vars");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const people = loadPeople();
  console.log(`parsed ${people.length} students`);

  const classNames = [...new Set(people.map((p) => p.className))];
  const classes = new Map();
  for (const name of classNames) {
    const { data: existing, error: findErr } = await db.from("classes").select("id").eq("name", name).maybeSingle();
    if (findErr) throw new Error(findErr.message);
    let id = existing?.id;
    if (!id) {
      const { data: created, error } = await db.from("classes").insert({ name, active: true }).select("id").single();
      if (error) throw new Error(`Could not create ${name}: ${error.message}`);
      id = created.id;
      console.log(`created class ${name}`);
    }
    const { data: groups, error: groupErr } = await db
      .from("class_groups")
      .select("id, subject")
      .eq("class_id", id);
    if (groupErr) throw new Error(groupErr.message);
    const bySubject = new Map((groups ?? []).map((g) => [g.subject, g.id]));
    if (!bySubject.get("math") || !bySubject.get("ebrw")) {
      throw new Error(`${name} is missing a Maths or Eng sub-class`);
    }
    classes.set(name, { id, bySubject });
  }

  const today = tashkentToday();
  const links = [];
  let created = 0;
  let reused = 0;
  const failures = [];

  for (const person of people) {
    try {
      const { data: prior, error: priorErr } = await db
        .from("students")
        .select("id, user_id, claimed_at")
        .eq("import_key", person.importKey)
        .maybeSingle();
      if (priorErr) throw new Error(priorErr.message);

      let userId = prior?.user_id ?? null;
      let studentId = prior?.id ?? null;
      let username = "";

      if (!userId) {
        const base = slugUsername(person.name);
        const { data: takenRows } = await db.from("profiles").select("username").ilike("username", `${base}%`);
        const taken = new Set((takenRows ?? []).map((r) => (r.username ?? "").toLowerCase()).filter(Boolean));
        username = base;
        let n = 2;
        while (taken.has(username)) {
          const suffix = String(n++);
          username = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
        }
        const email = `${username}@accounts.beyondsat.local`;
        const names = splitName(person.name);
        const { data: authUser, error: authErr } = await db.auth.admin.createUser({
          email,
          password: randomPassword(),
          email_confirm: true,
          user_metadata: { ...names, username, staff_created: true },
        });
        if (authErr || !authUser.user) throw new Error(authErr?.message ?? "createUser failed");
        userId = authUser.user.id;
        for (let i = 0; i < 12; i++) {
          const { data: row } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
          if (row) break;
          await sleep(150);
        }
        const gradeNumber = person.grade && /^\d+$/.test(person.grade) ? Number(person.grade) : null;
        const { error: profErr } = await db
          .from("profiles")
          .update({
            username,
            first_name: names.first_name,
            last_name: names.last_name,
            full_name: names.full_name,
            email,
            grade: gradeNumber,
            must_change_credentials: true,
            intro_completed: false,
            staff_created: true,
            chat_setup_completed: false,
          })
          .eq("id", userId);
        if (profErr) throw new Error(profErr.message);
        const { data: student, error: studentErr } = await db
          .from("students")
          .insert({
            full_name: names.full_name,
            phone: person.phone,
            parent_phone: person.parentPhone,
            grade: person.grade,
            english_note: person.englishNote,
            math_note: person.mathNote,
            goal: person.goal,
            user_id: userId,
            import_key: person.importKey,
          })
          .select("id")
          .single();
        if (studentErr || !student) {
          await db.auth.admin.deleteUser(userId);
          throw new Error(studentErr?.message ?? "student insert failed");
        }
        studentId = student.id;
        created += 1;
      } else {
        reused += 1;
        const { data: prof } = await db.from("profiles").select("username").eq("id", userId).maybeSingle();
        username = prof?.username ?? "";
      }

      const groupMap = classes.get(person.className).bySubject;
      for (const subject of person.subjects) {
        const groupId = groupMap.get(subject);
        const { error: memErr } = await db.from("class_group_memberships").insert({
          group_id: groupId,
          user_id: userId,
          status: "active",
          enrolled_on: today,
        });
        if (memErr && !/duplicate|unique|already exists/i.test(memErr.message)) {
          throw new Error(memErr.message);
        }
      }

      if (!prior?.claimed_at) {
        const { data: live } = await db
          .from("student_invites")
          .select("id")
          .eq("student_id", studentId)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (!live) {
          const now = new Date().toISOString();
          await db.from("student_invites").update({ used_at: now }).eq("student_id", studentId).is("used_at", null);
          const { token, hash } = newToken();
          const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          const { error: inviteErr } = await db.from("student_invites").insert({
            student_id: studentId,
            token_hash: hash,
            expires_at: expires,
          });
          if (inviteErr) throw new Error(inviteErr.message);
          links.push({ className: person.className, name: person.name, username, url: `${ORIGIN}/join/${token}` });
        }
      }
      if ((created + reused) % 25 === 0) console.log(`progress ${created + reused}/${people.length}`);
    } catch (err) {
      failures.push(`${person.className} ${person.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const outDir = resolve(root, "scripts/output");
  mkdirSync(outDir, { recursive: true });
  const csv = ["class,name,username,url", ...links.map((row) =>
    [row.className, row.name, row.username, row.url].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
  )].join("\n");
  writeFileSync(resolve(outDir, "student-invites.csv"), csv, "utf8");
  console.log(`created ${created}, reused ${reused}, new links ${links.length}, failures ${failures.length}`);
  for (const line of failures.slice(0, 30)) console.error(line);
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
