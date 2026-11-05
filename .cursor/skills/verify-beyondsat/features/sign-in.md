# Sign in

Sign in lets a student who already has an account enter an email and password. This map does not submit the form.

## Sub-features

- `signin-open` shows the email and password fields.
- `signin-empty` leaves the student on the form when they have not entered credentials.

## How to get to it (user POV)

- Choose `Sign In` in the top bar.
- Open `/signin` directly.

## Driving it with the Cursor browser

Preconditions:

- Doctor passes for `http://localhost:8080`.

- **Top bar.** From `http://localhost:8080/`, choose the link named `Sign In`. The address becomes `/signin` and a password field is on the page.
- **Direct URL.** Go to `http://localhost:8080/signin`. The same password field is present.
- **Do not submit.** Leave both fields empty. Do not press the submit control. The password field is still visible.
- **Proof.** Save a snapshot and a screenshot that show the BeyondSAT name and the password field to `.cursor/skills/verify-beyondsat/artifacts/sign-in/`.

## Gotchas

- A stored session redirects an already signed-in browser away from the form. If that happens, the entry point is not proved. Say so. Do not log the student out to force the form.
- Never type a real password into this flow.
