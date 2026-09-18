# A Feijoa on Monday — working notes

An interactive picture book for 4–5 year olds, built for a Victoria
University of Wellington course (COMDSIDN390). Plain HTML/CSS/JS, no
framework, no npm, no runtime build step. Deployed to GitHub Pages from
`main` via Actions.

## The governing rule

**Everything the reader sees or hears is the designer's, not the engine's.**
Backgrounds, objects, caption text and narration are all supplied artwork or
recordings by the author and her collaborator, with the narration voiced by
her 8-year-old son. The engine places, times and gates them.

Do not generate art, typeset story text, synthesize speech, recolour
drawings, or cut an object out of a background. If something is missing, ask
for the asset — don't invent a substitute.

## Where things live

- `content/` — source material, **excluded from the deployed site**.
  `content/pages/NN-slug/artifacts/` holds the artwork (3508 × 2480 sheets,
  each object drawn in its final position) and `artifacts/voice/` the MP3s.
- `content/project-info/build-guide.md` — the standing behaviour rules.
- `content/project-info/v2-plan.md` — the current piece of work in detail.
- `tools/` — the image pipeline, also excluded from the site.
- `assets/`, `css/`, `js/`, `index.html`, `sw.js` — the book itself.

## Conventions

- Positions are percentages of the 3508 × 2480 sheet, so nothing reflows
  between devices. The pipeline measures them; don't hand-guess coordinates.
- `js/layout.js` is **generated** by the pipeline (rectangles, word boxes,
  word timings). `js/story.js` is hand-written and refers to it by id.
- Page numbering: `00` = cover, `01`–`12` = the twelve story pages. The
  original brief's numbering is off by one after its duplicated "Page 2" —
  each `guide.md` states the real number.
- Word-highlight sync is driven by `audio.currentTime` every frame, never a
  timer.
- Only one thing invites a tap at a time; the forward arrow unlocks only
  once a page's activities are done.

## Verifying

There is no test framework — verification is the in-page harness plus
headless screenshots:

- `.\tools\verify.ps1` runs it all: `index.html?selftest=1` (walks the whole
  book, taps everything, checks gating, back navigation, every image and
  recording, sets the title to `TEST PASS` / `TEST FAIL`), a screenshot of
  every screen into `tools/out/shots/` plus one `contact-sheet.jpg`, and the
  portrait rotate prompt. `-Url <deployed url>` after a deploy, `-Bundle` for
  the offline file, `-NoShots` for the self-test alone.
- `?page=N`, `?fast=1`, `?boxes=1` (word boxes), `?envelope=1` (word
  timeline with playhead), `?rotatecheck=1` are the debug switches.
- `.\tools\serve.ps1` serves the book on http://localhost:8080 when the
  service worker or anything else http-only needs testing; otherwise opening
  `index.html` from disk is enough.
- Windows blocks scripts by default here: use `tools\serve.cmd`, or
  `powershell -ExecutionPolicy Bypass -File <script>`, or allow them once
  with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Look at the contact sheet as well as the report: only eyes catch a sprite in
  the wrong place. Audio sync cannot be verified headlessly — say so.

This machine has no Node, Python, ImageMagick or ffmpeg. Image work is
PowerShell + `tools/ImgTool.cs` (compiled on the fly with `Add-Type`);
browser automation is headless Edge at
`${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe`.

## Build and distribution

Two things ship from every build: the live Pages site, and a standalone copy
of the book that opens with no tools, no server and no internet.

- `tools/build-assets.ps1` — artwork and audio → `assets/` + generated
  `js/layout.js` (`-SkipAudio` reuses the committed timings for a quick
  image-only rebuild). **Local only**: it uses `System.Drawing` and headless
  Edge, so CI cannot run it. That is why built `assets/` are committed.
- `tools/bundle.ps1` — the site → `dist/a-feijoa-on-monday.html` (everything
  inlined) and `dist/a-feijoa-on-monday.zip`. PowerShell so it runs both
  locally and on the Linux runner via `pwsh`.
- `.github/workflows/build.yml` — pull request: build + attach the bundles
  to the run. Merge to `main`: build, deploy to Pages, update the rolling
  `latest` release.

**The bundle must run from `file://`.** No `fetch` or `XHR` for anything the
book needs to start — page data is `js/layout.js` and `js/story.js`, plain
scripts, never JSON loaded at runtime. This breaks silently and only shows
up when the downloaded file is opened from disk, so smoke-test the bundle
itself, not just the site.

See `.claude/skills/storybook-release/`.

## Git

**Do not commit, push, merge or tag.** The author does all of that; CI
deploys and releases. Build locally, verify, and say what is ready to
commit. Work happens on a feature branch that the author merges to `main`.
