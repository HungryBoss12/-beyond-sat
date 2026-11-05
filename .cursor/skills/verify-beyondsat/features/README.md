# BeyondSAT verification map

Read this index, then the feature file. Drive the real page. Do not treat a different route as proof of a path you did not open.

## Baseline preconditions

- BeyondSAT is healthy at `http://localhost:8080` (see the skill's Doctor section).
- Only one dev server can use port 8080. Do not start a second one.
- Public proofs use `/` and `/signin`. They do not need a new account.
- Do not type a real password.

## Driving conventions

- Use the Cursor browser. Prefer the accessible name in the feature file.
- Start from the URL named in the feature. Do not rely on leftover client state from an earlier proof.
- Capture the snapshot after the action, plus a screenshot, under `.cursor/skills/verify-beyondsat/artifacts/<feature-id>/`.

## Proof and skip reporting

- Record the feature ID and the entry point.
- If a precondition is missing, report that entry point as failed and name the gap. Do not substitute another path and call it verified.

## Features

- [Landing](./landing.md) covers the public home page and the Hall of Fame block.
- [Sign in](./sign-in.md) covers opening the sign-in form. It does not submit credentials.
- [Practice](./practice.md) covers the signed-in practice entry. It fails closed without a session.
