---
name: verify-beyondsat
description: Drive BeyondSAT in the browser the way a student would and keep proof. Use when a change touches the landing page, sign-in, practice, or any other user-visible route and the change needs evidence beyond unit tests.
---

# Verify BeyondSAT

BeyondSAT is a web app (TanStack Start). The primary surface is the browser. Authenticated routes also exist; they are not the default proof path because they need a signed-in student.

Evidence directory: `.cursor/skills/verify-beyondsat/artifacts/`. Cleanup never deletes that directory.

## Launch

One process may own port 8080. Do not start a second dev server, and do not kill a server this run did not start.

1. From the repo root, check the port. In PowerShell: `Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue`.
2. If nothing is listening, start the app and record the PID:

```
npm run dev
```

Ready means the log contains `Local:` and `http://localhost:8080/` answers with HTML whose title is `BeyondSAT`. A listening port alone is not ready.
3. If something is already listening, run Doctor. Drive it only when Doctor says the process is this app. Leave that process running at the end.
4. Teardown, only for a server this run started: stop that PID. Do not stop by process name.

The dev server uses the linked Supabase project. It does not boot from an empty database. Public pages (`/`, `/signin`) do not need a new account.

## Doctor

Run this before driving. All of the following must hold:

- `curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/` prints `200`.
- `curl.exe -s http://localhost:8080/` contains `BeyondSAT`.
- The listener on port 8080 is a `node` process (Vite). If it is not, stop. Do not drive another program.

## Drive

Use the Cursor browser tools. Prefer accessible names from the feature file over coordinates.

- Open `http://localhost:8080<path>`.
- Read the accessibility snapshot before clicking.
- Click and type through the snapshot refs (link, button, textbox names in the feature file).
- After a navigation or a submit, snapshot again and compare the visible name to the expected end state.

Do not submit a real password, payment, or account deletion during verification. Sign-in proof stops at the form being usable.

## Evidence

Save proof under `.cursor/skills/verify-beyondsat/artifacts/<feature-id>/`.

- An accessibility snapshot taken after the user action, not only before it.
- A screenshot of the resulting screen. The BeyondSAT name or the route heading must be visible.
- For an HTTP-only check, the status code and the matched title string.

A proof exercises the real page. Do not call an internal setter or a test-only endpoint and call that the user path. Unit tests are not a substitute for this skill.

## Cleanup

- If this run started `npm run dev`, stop that PID.
- If the server was already running, leave it running.
- Do not delete `.cursor/skills/verify-beyondsat/artifacts/`.

## Helpers

No helper script. Doctor and launch are the commands in those sections.
