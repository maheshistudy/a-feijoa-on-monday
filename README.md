# A Feijoa on Monday

A tap-along interactive picture book for 4–5 year olds — a very hungry
caterpillar eats his way through a week of Aotearoa kai. All artwork is
hand-drawn; the site is plain HTML/CSS/JS with no build step, no framework
and no npm.

**Live site:** https://maheshistudy.github.io/a-feijoa-on-monday/

## Read it offline

Download **`a-feijoa-on-monday.html`** from the
[latest release](https://github.com/maheshistudy/a-feijoa-on-monday/releases/latest)
and double-click it. It opens in your web browser and works offline, on a
laptop, tablet or phone — nothing to install. Turn the sound on, and hold a
phone sideways.

(`a-feijoa-on-monday.zip` in the same release is the same book as a folder:
unzip it and open `index.html`. It opens a little faster.)

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly with `file://`
works too, but the service worker only registers over http/https.)

Handy dev URLs:

- `index.html?page=7` — jump straight to a page (0-based), skipping the cover
- `index.html?selftest=1` — runs through every page automatically, tapping
  everything, and prints a pass/fail report (also sets the page title to
  `TEST PASS` / `TEST FAIL`)
- `index.html?fast=1` — no speech, timers shortened; useful when iterating

## What's in the book

Cover, then 12 pages: the egg on the leaf (night), the hatching (sunrise
cross-fade), one feijoa, two tamarillos, three kiwifruit, four nectarines,
five boysenberries, the Saturday feast (ten treats), the swan plant leaf,
the big fat caterpillar, the cocoon, and the monarch butterfly.

- **Narration** is read aloud with the device's built-in voice (Web Speech
  API), preferring a female English (NZ/AU/GB) voice, with the caption words
  highlighting in sync. Tap the caption to hear a page again.
- **Tapping** — fruit and treats get bitten one at a time (each bite is a
  masked hole in the drawing), numbers and fruit names are spoken when
  tapped, the egg wobbles then pops, the caterpillar grows, the cocoon
  sways, and the butterfly flies out in a trail of glitter.
- **Hints** — anything that wants a tap glows softly; after a few seconds of
  no taps, it wiggles and the little pointing hand shows where to press.
  The green arrow only wakes up (and beckons) once the page's taps are done
  and the narration has finished.
- **Sound** — all effects are synthesized with WebAudio (munch, pop, boing,
  fantail chirp, tummy gurgle, wing flutter, glitter…). The speaker button
  top-right mutes both effects and narration. Browsers only allow audio
  after a first tap — the cover's Start handles that. On iPads the hardware
  silent switch mutes web audio.

## Structure

- `index.html` — shell
- `css/style.css` — stage, sprites, atmosphere, animations
- `js/audio.js` — synthesized sound effects
- `js/story.js` — page data: text, sprites, positions, interactions, camera
- `js/app.js` — engine: rendering, narration + highlighting, taps, hints, page turns
- `assets/img/` — processed art (backgrounds, sprites, bite masks, icons)
- `manifest.webmanifest` + `sw.js` — installable PWA, works offline after first visit
- `content/` — the page-by-page brief and the raw artwork (not published)
- `tools/` — the image pipeline that turns the raw artwork into `assets/img/` (not published)

## Art pipeline

The artist draws every page on a 3508 × 2480 sheet, with each object
(fruit, number, word, cracked egg…) on its own sheet in the position where
it belongs. `tools/build-assets.ps1` (Windows PowerShell, compiles
`tools/ImgTool.cs` on the fly, no extra installs) turns those into:

- backgrounds resized to 1754 × 1240 JPEG;
- sprites keyed off the white sheet and auto-cropped, printing their
  position on the sheet so `story.js` can place them exactly;
- bite masks from the "hole" drawings (the hole is detected and reported, so
  multi-fruit sheets get one tappable cell per fruit);
- objects painted into a background (eggs, caterpillars, cocoons) lifted
  out as sprites, with the gap behind them filled so they can move.

Re-run it after changing artwork, then copy the printed rectangles into
`js/story.js`.

## Deploy

Pushes to `main` publish via GitHub Actions (`.github/workflows/deploy.yml`)
with `content/` and `tools/` excluded. The repo's Pages source must be set
to **GitHub Actions** (Settings → Pages) for the workflow to succeed.
