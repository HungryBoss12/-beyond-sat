/**
 * One-off: make each Maths and Eng roster match the active block of
 * Total work(2).xlsx. Does not print the service role key or invite tokens.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://beyond-sat-v0.javazbek80.workers.dev";
const LINKS_PATH = "C:\\Users\\javaz\\Downloads\\student-setup-links-2.txt";

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

function norm(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+\d*\s*hafta.*$/, "")
    .trim();
}

function tokenKey(value) {
  return norm(value).split(" ").filter(Boolean).sort().join(" ");
}

function splitName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? name.trim(),
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
    full_name: name.trim(),
  };
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > 2) return 3;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
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

async function fetchAll(db, table, columns) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from(table).select(columns).range(from, from + page - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return rows;
}

function loadPeople() {
  const parsed = spawnSync("python", [resolve(root, "scripts/parse-total-work-2.py")], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (parsed.status !== 0) {
    console.error(parsed.stderr || parsed.stdout);
    process.exit(parsed.status || 1);
  }
  return JSON.parse(parsed.stdout);
}

function sameName(account, person) {
  return account.norm === person.norm || (account.tokenKey && account.tokenKey === person.tokenKey);
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
  const people = loadPeople().map((person) => ({
    ...person,
    tokenKey: tokenKey(person.norm),
    words: person.norm.split(" ").filter(Boolean),
  }));
  console.log(`active people ${people.length}`);

  const { data: classRows, error: classErr } = await db.from("classes").select("id, name");
  if (classErr) throw new Error(classErr.message);
  const classByName = new Map((classRows ?? []).map((row) => [row.name, row.id]));
  const classNameById = new Map((classRows ?? []).map((row) => [row.id, row.name]));

  const { data: groupRows, error: groupErr } = await db.from("class_groups").select("id, class_id, subject");
  if (groupErr) throw new Error(groupErr.message);
  const groupByClassSubject = new Map();
  for (const group of groupRows ?? []) {
    const className = classNameById.get(group.class_id);
    if (!className) continue;
    groupByClassSubject.set(`${className}|${group.subject}`, group.id);
  }

  const students = await fetchAll(db, "students", "id, user_id, full_name, claimed_at, import_key, created_at");
  const profiles = await fetchAll(db, "profiles", "id, full_name, username");
  const memberships = await fetchAll(
    db,
    "class_group_memberships",
    "user_id, group_id, class_id, subject",
  );

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const accounts = new Map();
  for (const student of students ?? []) {
    if (!student.user_id) continue;
    const profile = profileById.get(student.user_id);
    const fullName = student.full_name || profile?.full_name || "";
    accounts.set(student.user_id, {
      userId: student.user_id,
      studentId: student.id,
      fullName,
      norm: norm(fullName),
      tokenKey: tokenKey(fullName),
      username: profile?.username ?? "",
      claimedAt: student.claimed_at,
      createdAt: student.created_at ?? "",
      importKey: student.import_key,
      memberships: [],
    });
  }
  for (const profile of profiles ?? []) {
    if (accounts.has(profile.id)) continue;
    const fullName = profile.full_name || "";
    if (!norm(fullName)) continue;
    accounts.set(profile.id, {
      userId: profile.id,
      studentId: null,
      fullName,
      norm: norm(fullName),
      tokenKey: tokenKey(fullName),
      username: profile.username ?? "",
      claimedAt: null,
      createdAt: "",
      importKey: null,
      memberships: [],
    });
  }
  for (const row of memberships ?? []) {
    const account = accounts.get(row.user_id);
    if (!account) continue;
    account.memberships.push({
      className: classNameById.get(row.class_id) ?? "",
      subject: row.subject,
      groupId: row.group_id,
    });
  }

  await mergeSameNameAccounts(db, accounts);

  const used = new Set();
  const pairedNorm = new Map();
  const paired = [];
  const matchCounts = {};

  function reusable(account, person) {
    if (!used.has(account.userId)) return true;
    return person.words.length >= 2 && pairedNorm.get(account.userId) === person.norm;
  }

  function free(list, person) {
    return list.filter((account) => reusable(account, person));
  }

  function take(account, person, how) {
    used.add(account.userId);
    if (!pairedNorm.has(account.userId)) pairedNorm.set(account.userId, person.norm);
    paired.push({ person, account, how });
    matchCounts[how] = (matchCounts[how] ?? 0) + 1;
  }

  function pick(list, person, how) {
    const open = free(list, person);
    const same = open.filter((account) => used.has(account.userId));
    if (same.length >= 1) {
      take(same[0], person, how);
      return true;
    }
    const fresh = open.filter((account) => !used.has(account.userId));
    if (!fresh.length) return false;
    const withClass = fresh.filter((account) => account.memberships.length > 0);
    const pool = withClass.length ? withClass : fresh;
    pool.sort((a, b) => b.memberships.length - a.memberships.length || (b.studentId ? 1 : 0) - (a.studentId ? 1 : 0));
    take(pool[0], person, how);
    return true;
  }

  for (const person of people) {
    const inGroup = [...accounts.values()].filter((account) =>
      account.memberships.some(
        (row) =>
          row.className === person.className &&
          person.subjects.includes(row.subject) &&
          sameName(account, person),
      ),
    );
    if (pick(inGroup, person, "name in group")) continue;
    const inClass = [...accounts.values()].filter(
      (account) =>
        account.memberships.some((row) => row.className === person.className) && sameName(account, person),
    );
    if (pick(inClass, person, "name in class")) continue;
    const elsewhere = [...accounts.values()].filter((account) => sameName(account, person));
    if (pick(elsewhere, person, "name in another class")) continue;
  }

  for (const person of people) {
    if (paired.some((row) => row.person === person)) continue;
    if (person.words.length < 2) continue;
    const hits = free([...accounts.values()], person).filter((account) => {
      if (account.norm.includes(" ")) return false;
      if (account.norm !== person.lastWord) return false;
      return account.memberships.some((row) => row.className === person.className);
    });
    if (hits.length === 1) take(hits[0], person, "one-word last name");
  }

  for (const person of people) {
    if (paired.some((row) => row.person === person)) continue;
    if (person.words.length < 2) continue;
    const hits = free([...accounts.values()], person).filter((account) => {
      const words = account.norm.split(" ").filter(Boolean);
      if (words.length !== person.words.length) return false;
      return editDistance(account.norm, person.norm) <= 2;
    });
    if (hits.length === 1) take(hits[0], person, "spelling");
  }

  const unmatched = people.filter((person) => !paired.some((row) => row.person === person));
  console.log("matches", matchCounts, "new", unmatched.length);
  if (unmatched.length > 20) {
    for (const person of unmatched) console.log("unmatched", person.className, person.name);
    throw new Error("Too many unmatched names; roster was not changed");
  }

  const desired = new Set();
  for (const row of paired) {
    for (const subject of row.person.subjects) {
      desired.add(`${row.account.userId}|${row.person.className}|${subject}`);
    }
  }

  const managed = new Set(people.map((person) => person.className));
  const removals = [];
  for (const account of accounts.values()) {
    for (const membership of account.memberships) {
      if (!managed.has(membership.className)) continue;
      const key = `${account.userId}|${membership.className}|${membership.subject}`;
      if (!desired.has(key)) removals.push({ account, membership });
    }
  }
  console.log(`removing ${removals.length} group memberships`);

  for (const row of removals) {
    const { error } = await db
      .from("class_group_memberships")
      .delete()
      .eq("group_id", row.membership.groupId)
      .eq("user_id", row.account.userId);
    if (error) throw new Error(`remove ${row.account.fullName}: ${error.message}`);
    row.account.memberships = row.account.memberships.filter(
      (item) => !(item.groupId === row.membership.groupId && item.subject === row.membership.subject),
    );
  }

  const today = tashkentToday();
  let added = 0;
  for (const row of paired) {
    for (const subject of row.person.subjects) {
      const already = row.account.memberships.some(
        (item) => item.className === row.person.className && item.subject === subject,
      );
      if (already) continue;
      const groupId = groupByClassSubject.get(`${row.person.className}|${subject}`);
      if (!groupId) throw new Error(`Missing group ${row.person.className} ${subject}`);
      const { error } = await db.from("class_group_memberships").insert({
        group_id: groupId,
        user_id: row.account.userId,
        status: "active",
        enrolled_on: today,
      });
      if (error) throw new Error(`add ${row.person.name} to ${row.person.className} ${subject}: ${error.message}`);
      row.account.memberships.push({
        className: row.person.className,
        subject,
        groupId,
      });
      added += 1;
    }
  }
  console.log(`added ${added} group memberships for existing accounts`);

  const takenKeys = new Set(
    [...accounts.values()].map((account) => account.importKey).filter(Boolean),
  );
  for (const row of paired) {
    await savePerson(db, row.account, row.person, takenKeys);
  }

  const links = [];
  const failures = [];
  for (const person of unmatched) {
    try {
      const created = await createPerson(db, person, groupByClassSubject, today, takenKeys);
      links.push(created);
      console.log(`created ${person.className} ${person.name}`);
    } catch (err) {
      failures.push(`${person.className} ${person.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (links.length) {
    const byClass = new Map();
    for (const link of links) {
      const list = byClass.get(link.className) ?? [];
      list.push(link);
      byClass.set(link.className, list);
    }
    const lines = ["", "Additional accounts", ""];
    for (const className of [...byClass.keys()].sort()) {
      lines.push(className);
      for (const link of byClass.get(className)) {
        lines.push(link.name);
        lines.push(link.username);
        lines.push(link.url);
        lines.push("");
      }
    }
    if (existsSync(LINKS_PATH)) appendFileSync(LINKS_PATH, lines.join("\r\n"), "utf8");
    else {
      writeFileSync(
        LINKS_PATH,
        ["BeyondSAT setup links", "New accounts from Total work(2).xlsx", ...lines].join("\r\n"),
        "utf8",
      );
    }
  }
  console.log(`new links ${links.length}, failures ${failures.length}`);
  for (const line of failures) console.error(line);

  const after = await fetchAll(
    db,
    "class_group_memberships",
    "class_id, subject, user_id, group_id",
  );
  const counts = new Map();
  for (const row of after ?? []) {
    const className = classNameById.get(row.class_id);
    if (!managed.has(className)) continue;
    const label = `${className} ${row.subject}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const expected = new Map();
  for (const person of people) {
    for (const subject of person.subjects) {
      const label = `${person.className} ${subject}`;
      expected.set(label, (expected.get(label) ?? 0) + 1);
    }
  }
  console.log("counts");
  for (const label of [...expected.keys()].sort()) {
    const got = counts.get(label) ?? 0;
    const want = expected.get(label);
    console.log(`${got === want ? "ok" : "DIFF"} ${label} ${got} want ${want}`);
  }

  const sat13Eng = groupByClassSubject.get("SAT 13|ebrw");
  const ids = after.filter((row) => row.group_id === sat13Eng).map((row) => row.user_id);
  const { data: fresh, error: freshErr } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (freshErr) throw new Error(freshErr.message);
  const engNames = (fresh ?? []).map((row) => row.full_name);
  const has = (needle) => engNames.some((name) => norm(name) === norm(needle));
  console.log("SAT 13 Eng Xudoyorov Mahmud", has("Xudoyorov Mahmud") ? "STILL THERE" : "gone");
  console.log("SAT 13 Eng Samariddin", engNames.some((name) => norm(name) === "samariddin") ? "STILL THERE" : "gone");
  console.log("SAT 13 Eng Eshquvvatov Bunyod", has("Eshquvvatov Bunyod") ? "kept" : "MISSING");
  console.log("SAT 13 Eng Muratov Imron", has("Muratov Imron") ? "kept" : "MISSING");

  if (failures.length) process.exitCode = 1;
}

async function mergeSameNameAccounts(db, accounts) {
  const groups = new Map();
  for (const account of accounts.values()) {
    if (account.norm.split(" ").filter(Boolean).length < 2) continue;
    const list = groups.get(account.norm) ?? [];
    list.push(account);
    groups.set(account.norm, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => {
      if (Boolean(a.claimedAt) !== Boolean(b.claimedAt)) return a.claimedAt ? -1 : 1;
      if (a.createdAt !== b.createdAt) return String(a.createdAt).localeCompare(String(b.createdAt));
      return b.memberships.length - a.memberships.length;
    });
    const keep = list[0];
    for (const extra of list.slice(1)) {
      const { data: ledger, error: ledgerErr } = await db
        .from("ledger_entries")
        .select("id")
        .eq("user_id", extra.userId)
        .limit(1);
      if (ledgerErr) throw new Error(ledgerErr.message);
      if (ledger?.length) {
        console.log("left duplicate with payments", extra.fullName, extra.username);
        continue;
      }
      for (const membership of extra.memberships) {
        const already = keep.memberships.some(
          (row) => row.className === membership.className && row.subject === membership.subject,
        );
        if (!already) {
          const { error } = await db.from("class_group_memberships").insert({
            group_id: membership.groupId,
            user_id: keep.userId,
            status: "active",
            enrolled_on: tashkentToday(),
          });
          if (error) throw new Error(`${extra.fullName}: ${error.message}`);
          keep.memberships.push({ ...membership });
        }
        const { error: dropErr } = await db
          .from("class_group_memberships")
          .delete()
          .eq("group_id", membership.groupId)
          .eq("user_id", extra.userId);
        if (dropErr) throw new Error(dropErr.message);
      }
      if (extra.studentId) {
        await db.from("student_invites").delete().eq("student_id", extra.studentId);
        const { error: studentErr } = await db.from("students").delete().eq("id", extra.studentId);
        if (studentErr) throw new Error(studentErr.message);
      }
      const { error: delErr } = await db.auth.admin.deleteUser(extra.userId);
      if (delErr) console.log("could not delete duplicate", extra.username, delErr.message);
      else accounts.delete(extra.userId);
      console.log("merged", extra.fullName, extra.username, "into", keep.username);
    }
  }
}

async function savePerson(db, account, person, takenKeys) {
  const names = splitName(person.name);
  const gradeNumber = person.grade && /^\d+$/.test(person.grade) ? Number(person.grade) : null;
  const importKey = `${person.className}|${person.norm}`;
  const patch = {
    full_name: names.full_name,
    phone: person.phone,
    parent_phone: person.parentPhone,
    grade: person.grade,
    english_note: person.englishNote,
    math_note: person.mathNote,
    goal: person.goal,
    description: person.description,
  };
  if (!account.importKey && !takenKeys.has(importKey)) {
    patch.import_key = importKey;
    takenKeys.add(importKey);
    account.importKey = importKey;
  }
  if (account.studentId) {
    const { error } = await db.from("students").update(patch).eq("id", account.studentId);
    if (error) throw new Error(`${person.name}: ${error.message}`);
  } else {
    const { data, error } = await db
      .from("students")
      .insert({ ...patch, user_id: account.userId, import_key: takenKeys.has(importKey) ? null : importKey })
      .select("id")
      .single();
    if (error) throw new Error(`${person.name} student: ${error.message}`);
    account.studentId = data.id;
    if (!takenKeys.has(importKey)) takenKeys.add(importKey);
  }
  const { error: profErr } = await db
    .from("profiles")
    .update({
      full_name: names.full_name,
      first_name: names.first_name,
      last_name: names.last_name,
      ...(gradeNumber != null ? { grade: gradeNumber } : {}),
    })
    .eq("id", account.userId);
  if (profErr) throw new Error(`${person.name} profile: ${profErr.message}`);
  account.fullName = names.full_name;
  account.norm = person.norm;
}

async function createPerson(db, person, groupByClassSubject, today, takenKeys) {
  const base = slugUsername(person.name);
  const { data: takenRows } = await db.from("profiles").select("username").ilike("username", `${base}%`);
  const taken = new Set((takenRows ?? []).map((row) => (row.username ?? "").toLowerCase()).filter(Boolean));
  let username = base;
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
  const userId = authUser.user.id;
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
  const importKey = `${person.className}|${person.norm}`;
  const useKey = !takenKeys.has(importKey);
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
      description: person.description,
      user_id: userId,
      import_key: useKey ? importKey : null,
    })
    .select("id")
    .single();
  if (studentErr || !student) {
    await db.auth.admin.deleteUser(userId);
    throw new Error(studentErr?.message ?? "student insert failed");
  }
  if (useKey) takenKeys.add(importKey);
  try {
    for (const subject of person.subjects) {
      const groupId = groupByClassSubject.get(`${person.className}|${subject}`);
      if (!groupId) throw new Error(`Missing group ${person.className} ${subject}`);
      const { error: memErr } = await db.from("class_group_memberships").insert({
        group_id: groupId,
        user_id: userId,
        status: "active",
        enrolled_on: today,
      });
      if (memErr) throw new Error(memErr.message);
    }
  } catch (err) {
    await db.from("students").delete().eq("id", student.id);
    await db.auth.admin.deleteUser(userId);
    throw err;
  }
  const { token, hash } = newToken();
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: inviteErr } = await db.from("student_invites").insert({
    student_id: student.id,
    token_hash: hash,
    expires_at: expires,
  });
  if (inviteErr) throw new Error(inviteErr.message);
  return { className: person.className, name: person.name, username, url: `${ORIGIN}/join/${token}` };
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
