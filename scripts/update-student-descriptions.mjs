/**
 * Update existing students from Total work(1).xlsx.
 * Does not create accounts, change usernames, or replace invite links.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+\d*\s*hafta.*$/, "")
    .trim();
}

function splitName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? name.trim(),
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
    full_name: name.trim(),
  };
}

function loadPeople() {
  const parsed = spawnSync("python", [resolve(root, "scripts/parse-total-work-1.py")], {
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

  const { data: students, error } = await db
    .from("students")
    .select("id, user_id, full_name, import_key");
  if (error) throw new Error(error.message);

  const { data: memberships, error: memErr } = await db
    .from("class_memberships")
    .select("user_id, class_id, classes(name)");
  if (memErr) throw new Error(memErr.message);
  const classByUser = new Map(
    (memberships ?? []).map((row) => [row.user_id, row.classes?.name ?? null]),
  );

  const byKey = new Map();
  const byClassWord = new Map();
  const byClassName = new Map();
  const oneWord = new Map();
  for (const student of students ?? []) {
    if (student.import_key) byKey.set(student.import_key, student);
    const className = classByUser.get(student.user_id);
    const normalized = norm(student.full_name ?? "");
    if (!className || !normalized) continue;
    byClassName.set(`${className}|${normalized}`, student);
    if (!normalized.includes(" ")) {
      byClassWord.set(`${className}|${normalized}`, student);
      const list = oneWord.get(className) ?? [];
      list.push({ word: normalized, student });
      oneWord.set(className, list);
    }
  }

  function uniqueWord(className, word) {
    const hits = (oneWord.get(className) ?? []).filter((row) => row.word === word);
    return hits.length === 1 ? hits[0].student : null;
  }

  let updated = 0;
  const missed = [];
  for (const person of people) {
    const firstWord = person.norm.split(" ")[0];
    const student =
      byKey.get(person.importKey) ??
      byClassWord.get(`${person.className}|${person.lastWord}`) ??
      byClassName.get(`${person.className}|${person.norm}`) ??
      (person.norm.includes(" ") ? uniqueWord(person.className, firstWord) : null) ??
      null;
    if (!student) {
      missed.push(`${person.className} ${person.name}`);
      continue;
    }
    const names = splitName(person.name);
    const gradeNumber = person.grade && /^\d+$/.test(person.grade) ? Number(person.grade) : null;
    const { error: studentErr } = await db
      .from("students")
      .update({
        full_name: names.full_name,
        phone: person.phone,
        parent_phone: person.parentPhone,
        grade: person.grade,
        english_note: person.englishNote,
        math_note: person.mathNote,
        goal: person.goal,
        description: person.description,
      })
      .eq("id", student.id);
    if (studentErr) throw new Error(`${person.name}: ${studentErr.message}`);
    if (student.user_id) {
      const { error: profErr } = await db
        .from("profiles")
        .update({
          full_name: names.full_name,
          first_name: names.first_name,
          last_name: names.last_name,
          ...(gradeNumber != null ? { grade: gradeNumber } : {}),
        })
        .eq("id", student.user_id);
      if (profErr) throw new Error(`${person.name} profile: ${profErr.message}`);
    }
    updated += 1;
  }

  console.log(`updated ${updated}, unmatched ${missed.length}`);
  for (const line of missed.slice(0, 40)) console.log("unmatched", line);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
