# A Feijoa on Monday

A tap-along interactive picture book for 4–5 year olds — a very hungry
caterpillar eats his way through a week of Aotearoa kai. The artwork is
hand-drawn, the story is read aloud by an eight-year-old, and the site is
plain HTML/CSS/JS with no framework and no npm.

**Live site:** https://maheshistudy.github.io/a-feijoa-on-monday/

## Read it offline

Download **`a-feijoa-on-monday.html`** from the
[latest release](https://github.com/maheshistudy/a-feijoa-on-monday/releases/latest)
and double-click it. It opens in your web browser and works offline, on a
laptop, tablet or phone — nothing to install. Turn the sound on, and hold a
phone sideways.

(`a-feijoa-on-monday.zip` in the same release is the same book as a folder:
unzip it and open `index.html`. It opens a little faster.)

## How the book behaves

Cover, then 12 pages: the egg on the leaf, the hatching, one feijoa, two
tamarillos, three kiwifruit, four nectarines, five boysenberries, the Saturday
feast (ten treats), the swan plant leaf, the big fat caterpillar, the cocoon,
and the monarch butterfly.

- **Everything on screen and everything you hear is the designer's.**
  Backgrounds, objects, the typeset caption panels, the arrows and the
  pointing hand are all supplied artwork, placed exactly where they were
  drawn. The narration is a recording of the author's son; the engine only
  places, times and gates.
- **Narration** plays as each page opens. The words of the caption panel
  light up one by one in time with the recording; the timing comes from the
  recording's own rhythm and the highlight follows the audio playhead, so it
  cannot drift. Tap the caption to hear the page again.
- **Tapping** — fruit and treats get bitten one at a time (each bite is the
  designer's own "hole" drawing), the number and the fruit name say their
  word in the child's voice, the egg wobbles then pops, the leaf gets eaten,
  the caterpillar reacts, the cocoon sways, and the butterfly flies out.
- **One thing at a time.** While the story is being read, both arrows are
  off. When it ends, whatever needs a tap glows and gives a little wiggle,
  and after a few idle seconds the pointing hand shows where to press. Once
  the page's taps are done, the green **next** arrow wakes up and beckons.
  The **back** arrow is available as soon as the reading ends; going back
  replays the previous page from the top.
- **Sound** — small synthesized effects (munch, pop, boing, chirp…) sit
  quietly under the voice. The speaker button top-right mutes everything.
  Browsers only allow audio after a first tap — the cover's Start arrow is
  that tap. On iPads the hardware silent switch mutes web audio.
- **Any device** — the page keeps the artwork's shape and fills a laptop,
  an iPad or a landscape phone; a phone held upright is asked to turn.
  Keyboard: ←/→ turn pages, Enter/Space taps the focused thing.

## Run locally

Open `index.html` directly (it works from `file://`), or serve the folder:

```
python3 -m http.server 8000
```

Handy dev URLs:

- `index.html?page=7` — jump straight to a page (0-based), skipping the cover
- `index.html?selftest=1` — walks the whole book, taps everything, checks
  gating, back navigation, every image and recording, and prints a report
  (also sets the page title to `TEST PASS` / `TEST FAIL`)
- `index.html?fast=1` — silent read-along at 30× speed; useful when iterating
- `index.html?boxes=1` — outlines the detected word boxes on the captions
- `index.html?envelope=1` — a word timeline with a moving playhead, to check
  the highlight against the recording by ear

## Structure

- `index.html` — shell
- `css/style.css` — stage, sprites, invitation and tap animations
- `js/layout.js` — **generated** by the pipeline: every measured rectangle,
  bite cell, word box and word timing
- `js/story.js` — hand-written page data: which layers, which taps, which
  recording, referring to `layout.js` by id
- `js/app.js` — engine: rendering, narration sync, gating, hints, page turns,
  self-test
- `js/audio.js` — synthesized tap effects
- `assets/img/`, `assets/audio/` — processed art and the recordings
- `manifest.webmanifest` + `sw.js` — installable PWA, works offline after
  the first visit
- `content/` — the page-by-page brief, the raw artwork and the recordings
  (not published)
- `tools/` — the pipeline, the bundler and the verifier (not published)

## Art and audio pipeline

The artist draws every page on a 3508 × 2480 sheet, with each object on its
own sheet **in the position it occupies on the page**, plus the caption
panel typeset on its cream band. `tools/build-assets.ps1` (Windows
PowerShell, compiles `tools/ImgTool.cs` on the fly) turns those into:

- backgrounds resized to 1754 × 1240 JPEG;
- sprites keyed off the white sheet and auto-cropped, with their measured
  position written to `js/layout.js`;
- bite masks from the "hole" drawings, one tappable cell per fruit;
- the caption panels, with each word's box detected on the band and
  checked against the story text;
- the recordings, renamed, with per-word timings derived from each MP3's
  envelope in headless Edge.

`tools/verify.ps1` then runs the self-test, screenshots every screen into a
contact sheet, and checks the rotate prompt. `tools/bundle.ps1` builds the
two offline downloads into `dist/`.

## Deploy

`.github/workflows/build.yml`: a pull request bundles and self-tests the
book and attaches both downloads to the run; a push to `main` also deploys
to GitHub Pages and refreshes the rolling `latest` release. The repo's Pages
source must be **GitHub Actions** (Settings → Pages).
