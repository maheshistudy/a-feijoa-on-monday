# Storybook build guide (general, minimal)

The standing rules for how this book behaves, distilled from the original
project brief (`COMDSIDN390_2_PRODUCE brief1.pdf` in this folder) and
updated for v2. The brief's own file/folder structure section is left out —
it no longer matches this repo; the top-level [README.md](../../README.md)
is the current source of truth for that. For the v2 work in detail, see
[v2-plan.md](v2-plan.md).

## The governing rule

**Everything the reader sees or hears is the designer's, not the engine's.**
Backgrounds, objects, caption text and narration are all supplied artwork or
recordings. The engine places, times and gates them — it never generates
art, never typesets story text, and never synthesizes a voice. When
something is missing, the answer is to ask for the asset, not to invent a
substitute.

## Look & feel target

Built for 4–5 year olds: warm, gentle, immediately understandable without
reading. Every interaction should feel delightful — soft bounces, sparkles,
and a satisfying sound on tap, never harsh or startling.

## Art style

All backgrounds and characters are hand-drawn and supplied as JPG/PNG on
3508 × 2480 sheets, each object drawn in the position it occupies on the
page. Use them as-is — crop and resize only. Do not replace them with
generated art or SVG substitutes, do not recolour them, and do not cut an
object out of a background: if an object needs to move, ask for it as its
own layer.

## Narration

- Every page is read aloud from a **recording of the author's son**, in
  `content/pages/<page>/artifacts/voice/`, prefixed `narration-`.
- The caption is the designer's own typeset panel (`P1.jpg`–`P12.jpg`),
  composited at exactly the position it occupies on its source sheet.
- Words highlight one at a time **on top of that panel image**, in sync with
  the recording's real rhythm. Timings are derived from each MP3's audio
  envelope at build time and committed; playback is driven by the audio
  element's own `currentTime`, never a timer, so it cannot drift.
- Tapping the caption replays the page's narration.
- Numbers and fruit names have their own recordings, played when the child
  taps that number or word.

## Navigation

- A forward arrow (bottom-right) and a back arrow (bottom-left) on every
  page, both supplied as artwork and placed where they were drawn. The
  cover has neither — only its Start arrow.
- Both start disabled. The **back** arrow enables once narration finishes.
  The **forward** arrow enables only when the page's required activities are
  complete, and then beckons.
- Going back replays the previous page in full: narration from the start,
  activities reset.

## Tap targets and hinting

- Exactly **one** thing invites a tap at any moment — never a pending
  activity and the forward arrow at once.
- Whatever is next glows softly and wiggles periodically; after a few idle
  seconds the designer's pointing-hand image moves to it.
- Every tap gets a visible answer within 100 ms, plus a sound.
- Disabled controls are dimmed and inert — never an error, never a refusal
  animation.
- Nothing is a dead end: the back arrow and the replayable caption always
  offer a way on.

## Sound

Synthesized WebAudio effects (pop, munch, wobble, shimmer) for tap feedback
only, at reduced volume, ducking further while narration plays — the
recorded voice always dominates. No external audio files beyond the
recordings themselves. Sounds should be warm and playful, never sharp or
startling.

## Devices

Primary target is a landscape tablet; also laptop and phone, touch and
mouse, with keyboard support on laptops. The stage keeps the artwork's
3508 × 2480 ratio, centred and letterboxed, so no layout reflows between
devices. A phone held in portrait gets a friendly rotate prompt rather than
a squeezed page. `prefers-reduced-motion` is respected.

## Additional effects

Keep them minimal. Atmosphere (a few drifting clouds, a glow, sparkles on
tap) is welcome where it supports the page, but the drawings carry the
book — motion should never compete with them.

## Build approach

Static site only — plain HTML/CSS/JS, no framework, no build step at
runtime, no npm. Artwork and audio are processed once by
`tools/build-assets.ps1` into `assets/`, which also emits the generated
`js/layout.js` holding every measured rectangle, word box and word timing.
`js/story.js` stays hand-written for narrative and interaction. Re-running
the pipeline from a clean `assets/` must reproduce it exactly.
