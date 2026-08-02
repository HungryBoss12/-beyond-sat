# Moving BeyondSAT to a fresh Supabase project

The current project (`secadznjokojeswksmbx`) was provisioned by Lovable inside
**Lovable's own Supabase organisation**, not yours. That is why signing in with
your GitHub shows no such project — it was never in your account. The API keys
still work (the live site proves it), but the dashboard is out of reach, so no
SQL can be run against it.

This moves the app to a project you own.

**What comes across:** the entire schema — 18 tables, 5 enum types, 15
functions, every RLS policy, and the seeded homepage content.

**What does not:** every existing user account. Password hashes live in
`auth.users`, which no API exposes, so they cannot be copied. Everyone
re-registers, including you. Questions, mock exams, daily tests and news
articles are also not carried over by these steps — see *Rescuing old content*
at the end if you want them.

---

## 1. Create the project

1. <https://supabase.com/dashboard> → **New project**
2. Organisation: your personal one.
3. Name: anything (`beyond-sat` is fine).
4. **Database password: generate one and save it in a password manager.** You
   will not be shown it again, and you need it for direct database access.
5. Region: pick the one nearest your users.
6. Create, then wait ~2 minutes for provisioning to finish.

## 2. Run the schema

1. In the new project: **SQL Editor** → **New query**.
2. Open [supabase/FRESH_PROJECT_SCHEMA.sql](supabase/FRESH_PROJECT_SCHEMA.sql),
   select all, paste into the editor.
3. **Run.**

It should finish with `Success. No rows returned`. Run it as one execution —
do not split it up.

> This file is generated from `supabase/migrations/` rather than being a
> hand-written copy, so it cannot drift from what the app expects. It differs
> from the raw migration folder in three ways, all necessary:
>
> - Two early migrations are omitted. `20260718183907` creates `public.profiles`
>   and two triggers that `20260718230822` then creates *again* with more
>   columns, and nothing drops them in between — replaying both fails with
>   `relation "public.profiles" already exists`. The security REVOKEs from the
>   second file are preserved at the bottom of the generated schema.
> - Every `ALTER TYPE … ADD VALUE` is folded into its original `CREATE TYPE`.
>   Postgres refuses to *use* an enum label in the same transaction that added
>   it, and the SQL editor runs one transaction per execution. **This is why
>   there is no two-step run any more** — `app_role` is created as
>   `('student', 'admin', 'editor')` from the start.
> - Nothing else is reordered.

**Verify** — run this in a new query tab:

```sql
select
  (select count(*) from information_schema.tables  where table_schema = 'public') as tables,
  (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e')                               as enums,
  (select count(*) from pg_policies where schemaname = 'public')                  as policies,
  (select count(*) from public.homepage_sections)                                 as homepage_rows;
```

Expect **18 tables, 5 enums, and 5 homepage rows**. Policy count will be in the
sixties; the exact number does not matter, only that it is not zero.

The schema also seeds `public.exam_dates` with eight upcoming Saturday slots.
That is deliberate: onboarding makes every new user pick an exam date, only an
admin can create them, and every signed-in route redirects to `/onboarding`
until it is finished — so an empty table locks out even the first admin. Check
the dates against collegeboard.org and correct them in **Admin → Exam Dates**
once you are in; they are the usual slots, not scraped from the official
calendar.

> **Already ran the schema before this seed existed?** Your `exam_dates` table
> is empty and signup dead-ends. Paste
> [supabase/SEED_EXAM_DATES.sql](supabase/SEED_EXAM_DATES.sql) into the SQL
> editor and run it. Safe to run twice.

## 3. Create the storage bucket

No migration creates this — only its access policies — so it must be added by
hand or every question image 404s.

**Storage** → **New bucket** → name it exactly `question-images` → leave
**Public** switched **off** → Create.

The policies from step 2 already cover it: any signed-in user can read, only
admins can write.

## 4. Point the app at the new project

In the new dashboard, go to **Project Settings → API** and copy:

- **Project URL** — `https://<new-ref>.supabase.co`
- **Publishable / anon key** — the long public one. **Not** `service_role`.

Then update **three** places. Missing any one of them leaves part of the app on
the dead project.

**a. `.env`** — local dev. All six values, and note the URL appears twice:

```
SUPABASE_PROJECT_ID=<new-ref>
SUPABASE_URL=https://<new-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<new-anon-key>
VITE_SUPABASE_PROJECT_ID=<new-ref>
VITE_SUPABASE_URL=https://<new-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<new-anon-key>
```

**b. [wrangler.jsonc](wrangler.jsonc)** — this one is committed to git and is
what the deployed Worker reads during SSR. Both values under `"vars"` still
point at the old project:

```jsonc
"vars": {
  "SUPABASE_URL": "https://<new-ref>.supabase.co",
  "SUPABASE_PUBLISHABLE_KEY": "<new-anon-key>"
}
```

**c. Cloudflare dashboard** → your Worker → **Settings → Variables**. If
`SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` are set there, update them too —
dashboard variables override `wrangler.jsonc`.

Also update [.dev.vars.example](.dev.vars.example) so the next person cloning
the repo does not get the dead URL. It is documentation only, nothing reads it.

> **Do not put `SUPABASE_SERVICE_ROLE_KEY` in `wrangler.jsonc`.** That file is
> in git, and the service-role key bypasses row-level security completely. If
> you ever need it, set it as a secret:
> `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`

## 5. Turn off email confirmation (recommended for now)

**Authentication → Providers → Email** → switch **Confirm email** off.

A brand-new project has no custom SMTP, so confirmation mails go through
Supabase's shared sender, which is heavily rate-limited and often lands in
spam. With it off, signup logs you straight in. Turn it back on once you have
configured a real SMTP provider.

## 6. Create your admin account

1. Start the app (`npm run dev`, or use the deployed site once it redeploys).
2. **Sign up normally** through the app's own form. This matters — the signup
   flow hashes the password and fires `handle_new_user()`, which creates your
   `profiles` row and a default `student` role.
3. Back in the SQL editor, open
   [supabase/FRESH_PROJECT_STEP2_ADMIN.sql](supabase/FRESH_PROJECT_STEP2_ADMIN.sql),
   **replace every `CHANGE-ME@example.com` with your real address**, and run it.
4. It ends with a `select` — confirm it returns your email with `role = admin`.
5. Sign out and back in. The session caches your role, so the admin panel will
   not appear until you do.

## 7. Redeploy

Committing the `wrangler.jsonc` change and pushing to `main` triggers the
Cloudflare build automatically (~1–3 minutes). There is no staging environment,
so the change is live as soon as it finishes.

---

## Rescuing old content

Losing the dashboard does not mean losing the content. The old project's REST
API still works, and the publishable key plus your old admin login satisfies
every RLS policy on the content tables — so questions, mock exams, daily
tests, news and exam dates can all be pulled out and pushed into the new
project instead of being retyped.

[export-content.cjs](export-content.cjs) does this. Fill in the `CONFIG` block
at the top (old URL/key/admin login, new URL/key/admin login), then:

```bash
node export-content.cjs export    # read-only: writes content-export/*.json
node export-content.cjs import    # pushes those files into the new project
```

Run `export` first and look at the JSON before importing. Do the import
**after** step 6, since it signs in as the new admin to get past RLS.

Two details worth knowing:

- **The answer key needs a special path.** Migration `20260721232119` revokes
  `SELECT` on `correct_choice_id`, `correct_grid_answers` and `explanation` at
  the *column* level, so no query can read them, admin or not. The script goes
  through the `admin_get_question_answers` RPC — one call per question, which
  is slow for a large bank but is the only route that exists.
- **`homepage_sections` is cleared before import.** The schema already seeds
  five landing sections with fresh ids; importing the old rows on top would
  leave both sets and render every section twice.

`created_by` and `author_id` are set to `null` on import — they point at users
who no longer exist. `test_sessions` and `attempts` are not migrated at all,
for the same reason: every row references a dead user id.

Question images are a loose end. If `image_url` values point at the old
project's storage domain they will keep working while that project exists, but
they live in the old bucket — re-upload anything you want to keep.

> I could not test this script end to end: my environment has no outbound
> network access, so it is verified for syntax and logic only. The export half
> is read-only, so the safe way to shake it out is to run `export` first and
> inspect the JSON.

## If something goes wrong

| Symptom | Cause |
|---|---|
| `relation "public.profiles" already exists` | You ran the raw migration folder instead of `FRESH_PROJECT_SCHEMA.sql`. Reset the database (Settings → General → Reset) and run the generated file. |
| `unsafe use of new value "editor"` | Same cause. The generated file cannot produce this error — it has no `ALTER TYPE … ADD VALUE` left. |
| Onboarding says "no exam dates published" and Continue stays disabled | `exam_dates` is empty — run [supabase/SEED_EXAM_DATES.sql](supabase/SEED_EXAM_DATES.sql). On the current code you can also just type a date instead. |
| Admin panel missing after step 6 | You did not sign out and back in. |
| Images 404 | Step 3 skipped, or the bucket name is not exactly `question-images`. |
| Site still shows old data after deploy | `wrangler.jsonc` not updated, or a Cloudflare dashboard variable is overriding it. |
| Login works locally but not on the live site | Step 4c — the deployed Worker has its own copy of the env vars. |
