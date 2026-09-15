import fs from "fs";
import pg from "pg";

function loadDevVars() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

const env = loadDevVars();
const projectRef = env.SUPABASE_PROJECT_ID || "qlzvngegsemrzmyxwykl";
const dbPassword = (env.SUPABASE_DB_PASSWORD ?? "").trim();
if (!dbPassword) {
  console.error("Missing SUPABASE_DB_PASSWORD in .dev.vars");
  process.exit(1);
}

const files = [
  "supabase/migrations/20260914000001_test_session_hardening.sql",
  "supabase/migrations/20260914000002_profile_security.sql",
  "supabase/migrations/20260914000003_grid_match_student_places.sql",
];

const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
];

async function tryConnect(host, port, user) {
  const client = new pg.Client({
    host,
    port,
    user,
    password: dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

let client = null;
let connected = "";
for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  for (const port of [5432, 6543]) {
    try {
      client = await tryConnect(host, port, `postgres.${projectRef}`);
      connected = `${host}:${port}`;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/password authentication failed|SASL/i.test(msg)) {
        console.error(`Auth failed on ${host}:${port}`);
        process.exit(1);
      }
    }
  }
  if (client) break;
}

if (!client) {
  console.error("Could not reach the Supabase pooler on IPv4");
  process.exit(1);
}
console.log(`Connected ${connected}`);

async function stamp(version, name, sql) {
  try {
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ($1, $2, $3)
       on conflict (version) do nothing`,
      [version, name, [sql]],
    );
  } catch {
    await client.query(
      `insert into supabase_migrations.schema_migrations (version)
       values ($1)
       on conflict (version) do nothing`,
      [version],
    );
  }
}

const { rows: existing } = await client.query(
  `select version from supabase_migrations.schema_migrations`,
);
const applied = new Set(existing.map((r) => String(r.version)));
console.log(`Remote already has ${applied.size} migrations`);

for (const file of files) {
  const version = file.match(/(\d{14})_/)[1];
  const name = file.replace(/^.*\d{14}_/, "").replace(/\.sql$/, "");
  if (applied.has(version)) {
    console.log(`SKIP ${version} ${name} (already applied)`);
    continue;
  }
  const sql = fs.readFileSync(file, "utf8");
  console.log(`APPLY ${version} ${name}`);
  await client.query("begin");
  try {
    await client.query(sql);
    await stamp(version, name, sql);
    await client.query("commit");
    console.log(`OK ${version}`);
  } catch (e) {
    await client.query("rollback");
    console.error(`FAIL ${version}`, e.message);
    process.exitCode = 1;
    break;
  }
}

await client.end();
if (!process.exitCode) console.log("MIGRATIONS_DONE");
