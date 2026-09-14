# Storybook build guide (general, minimal)

The effect/behaviour rules that should apply across every page, distilled
from the original project brief (`COMDSIDN390_2_PRODUCE brief1.pdf` in this
folder). The brief's own file/folder structure section is intentionally
left out here — it no longer matches this repo; the top-level
[README.md](../../README.md) is the current source of truth for that.

## Look & feel target

Built for 4–5 year olds: warm, gentle, immediately understandable without
reading. Every interaction should feel delightful — soft bounces, sparkles,
and a satisfying sound on tap, never harsh or startling.

## Art style

All backgrounds and characters are hand-drawn and uploaded as JPG/PNG. Use
them as-is — crop, layer-separate, recolour, resize — but don't replace them
with generated art or SVG substitutes. Where a prop hasn't been drawn, use a
simple flat-colour SVG matching the bold-outline house style.

## Navigation

- One fixed green arrow button, bottom-right, on every page.
- Starts disabled/faded; enables only once that page's required
  interactions are complete.
- Once enabled, it should visibly invite the tap — a gentle pulse, glow, or
  wiggle, not just a colour change — so a young child immediately sees
  what to do next.
- Tapping it transitions to the next page with a smooth page-turn
  animation.

## Tappable-object hinting

- Any object the child needs to tap should wiggle or move gently to invite
  the tap, like a soft button nudge — not just sit still.
- Untapped objects idle-hint (a small wiggle/bounce) every few seconds so a
  child never gets stuck looking for what to do.
- Every tap gets a sparkle burst, a short reaction animation, and a nice
  sound — the payoff should feel good.

## Narration & text

- Every page is read aloud via the Web Speech API, using a natural-sounding
  female voice (pick the best available female voice on the device; fall
  back gracefully if none is available).
- Story text shows in a styled caption bar at the bottom of the page, with
  words highlighting one at a time (karaoke-style) in sync with the spoken
  narration — highlight timing should track the speech, not run on a fixed
  timer independent of it.
- Decided: this supersedes the brief's original "text-only, no spoken
  voice" instruction.

## Sound

Synthesized WebAudio sound effects for every interaction (pop, wobble,
munch, shimmer, etc.) — no external audio files required. Sounds should be
warm and playful, never sharp or startling.

## Camera

The whole scene lives in one `#world` container. Each page sets a CSS
transform (scale + origin) on `#world` to zoom into a different part of the
same background art, giving each page its own composition without needing
new art.

## Atmosphere

- Night pages: twinkling stars, fireflies.
- Day pages: sun glow, rotating rays, drifting clouds.
- A soft vignette frames every page.

## Devices

Primary target is a landscape tablet (iPad/Android); also works on
laptop/desktop with both touch and mouse. Fixed-ratio stage centred on
screen, letterboxed on non-matching screens.

## Image processing

As new art comes in: separate objects from backgrounds (inpainting the
gap left behind), recolour scenes where needed (e.g. night → day), cut out
characters with transparent backgrounds, and fill the interiors of
line-art so characters read against any background.

## Build approach

Static site only — plain HTML/CSS/JS, no framework, no build step, no npm.
Pages are added incrementally by extending `js/story.js` (page data) and
`assets/img/` (art); the engine (`app.js`, `audio.js`, `css/style.css`)
should rarely need to change once it's in place.

---

Guide only for now — the actual build starts when asked for.
