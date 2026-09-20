/** Verify anon can read homepage_sections after the RLS fix. */
import fs from "node:fs";

function loadDevVars() {
  return Object.fromEntries(
    fs.readFileSync(".dev.vars", "utf8").split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}
const env = loadDevVars();
const anon = env.SUPABASE_PUBLISHABLE_KEY;
const res = await fetch(
  "https://qlzvngegsemrzmyxwykl.supabase.co/rest/v1/homepage_sections?select=id,kind,visible&visible=eq.true&order=position.asc",
  { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
);
const body = await res.text();
console.log("status", res.status);
console.log(body.slice(0, 500));
