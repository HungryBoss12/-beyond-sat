# Practice

Practice is the signed-in place where a student works through SAT questions. Without a session the app does not show the question player.

## Sub-features

- `practice-gate` sends a signed-out visitor to sign in instead of opening a question.

## How to get to it (user POV)

- Choose `Start Practicing` on the home page.
- Open a practice route while signed in (only after a real session exists; this map does not create one).

## Driving it with the Cursor browser

Preconditions:

- Doctor passes for `http://localhost:8080`.
- The browser has no BeyondSAT session. If a session is already present, stop and report that `practice-gate` was not proved.

- **Start control.** From `http://localhost:8080/`, choose `Start Practicing`. The page shows the sign-in form (a password field) and does not show a question prompt.
- **Proof.** Save a snapshot and a screenshot of that sign-in form to `.cursor/skills/verify-beyondsat/artifacts/practice/`.

## Gotchas

- If the visitor is already signed in, `Start Practicing` opens practice instead of the gate. That is a different behavior. Do not call it proof of `practice-gate`.
- Do not create an account or submit credentials to reach the player. A signed-in journey is out of scope until a disposable test account is provided.
