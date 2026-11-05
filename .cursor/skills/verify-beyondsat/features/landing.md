# Landing

The landing page is the public home screen. It introduces BeyondSAT and shows the Hall of Fame block for students who already have scores on file.

## Sub-features

- `landing-open` loads the home page.
- `landing-hall` shows the Hall of Fame heading and the top score once that block is on screen.

## How to get to it (user POV)

- Open the site root.
- Choose `Beyond SAT` in the top bar from any public page.

## Driving it with the Cursor browser

Preconditions:

- Doctor passes for `http://localhost:8080`.

- **Open the home page.** Go to `http://localhost:8080/`. The document title contains `BeyondSAT` and a heading names the Digital SAT coach.
- **Reach the Hall of Fame.** Go to `http://localhost:8080/#reviews` and scroll the `Students who got there` heading into view. The heading is visible, the words `Top score` are visible, and a score number is visible near that label.
- **Proof.** Save an accessibility snapshot and a screenshot that include the BeyondSAT name and `Students who got there` to `.cursor/skills/verify-beyondsat/artifacts/landing/`.

## Gotchas

- The Hall of Fame block is below the fold. A screenshot of the hero does not prove it.
- Score digits animate when the block enters the viewport. Wait until the number has finished rolling before treating a half-written score as the end state.
- The dev server is shared. Do not restart it to get a clean page. Reload the URL instead.
