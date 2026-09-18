---
name: storybook-assets
description: Build and verify the Feijoa storybook's assets — process the designer's 3508x2480 artwork sheets and recorded MP3s into assets/img, assets/audio and the generated js/layout.js, then verify the result headlessly with tools/verify.ps1. Use when artwork or voice recordings are added or changed, when sprite positions or word boxes look wrong, when word highlighting drifts against the recording, or when running the book's self-test and screenshots.
---

# Storybook asset pipeline

This repo has no Node, Python, ImageMagick or ffmpeg. Everything below uses
Windows PowerShell plus `tools/ImgTool.cs` (a small C# image library
compiled on the fly) and headless Edge.

## Ground rules

Read `CLAUDE.md` and `content/project-info/build-guide.md` first. The one
that matters most: the engine never generates art, text or speech. Source
artwork in `content/` is never modified — the pipeline only reads it and
writes normalised copies into `assets/`.

Every object is drawn on a 3508 × 2480 sheet **in the position it occupies
on the finished page**. The pipeline's job is to measure those positions,
not to invent a layout. (The one exception is the Saturday treats, which
come on a 5 × 2 contact sheet; `js/story.js` lays them out in two rows.)

## Running the pipeline

```powershell
.\tools\build-assets.ps1              # everything, ~1 minute
.\tools\build-assets.ps1 -SkipAudio   # images only; reuses the timings in js/layout.js
```

It compiles `tools/ImgTool.cs`, clears `assets/`, and rebuilds everything,
printing one line per asset with its measured rectangle. It must stay
re-runnable: delete `assets/` and `js/layout.js`, run it, get the same tree.
Save it as UTF-8 **with BOM** — it contains em dashes, and PowerShell 5.1
reads a BOM-less file as ANSI and mangles them.

Outputs:

- `assets/img/` — backgrounds (`bg-*.jpg`, 1754 × 1240 q84) and sprites
  (PNG, half sheet scale, transparent), caption panels `text-pNN.png`
- `assets/audio/` — the 33 recordings, renamed canonically
- `js/layout.js` — **generated**: `img` (rectangles), `holes` (bite cell
  centres), `captions` (panel rectangle + word boxes), `audio`, `timings`,
  `text`, `flags`. Never hand-edit it; change the pipeline instead.
- `tools/out/` (git-ignored) — `build-log.txt`, `boxes-*.png` (word boxes
  drawn on each panel), `envelope-*.png` (each recording's envelope with the
  derived word spans)

Stages: backgrounds → shared chrome (arrows, hand) → objects → caption
panels + word boxes → audio copy → timing analysis → emit `layout.js`.
Every stage fails loudly (`Fail`) rather than shipping a wrong asset.

## Using ImgTool directly

```powershell
Add-Type -Path "tools\ImgTool.cs" -ReferencedAssemblies System.Drawing
[ImgTool]::KeyCrop("content\pages\01-egg-on-leaf\artifacts\Page1-egg.jpg",
                   "out.png", 0,0,0,0, "white", 6, 24, 0.5, 6, 200)
# -> {"file":"out.png","x":1167,"y":1094,"w":253,"h":360}
```

- `KeyCrop(src, dst, rx,ry,rw,rh, bgMode, tolHard, tolSoft, scale, pad, minArea)`
  — flood-key the background from the border, auto-crop, report the box.
  `bgMode` is `"white"` or `"auto"` (samples the border colour).
- `MaskCrop(fullSrc, holeSrc, dst, bx,by,bw,bh, …)` — bite mask + the centre
  of each hole, so a multi-fruit sheet becomes one tappable cell per fruit.
- `SplitByColor(src, mainDst, colorDst, bgMode, …, r,g,b, tol, dilate, …)` —
  separates a branch (near-colour pixels whose component touches the sheet
  edge) from the cocoon hanging on it, so the cocoon can move on its own.
- `BiteComposite(still, biteSheet, dst, holeRect, …)` — page 9: the bitten
  leaf backed with sky wherever the background's whole leaf would show
  through the bite. Reports `uncovered` (should be 0).
- `WordBoxes(src, rx,ry,rw,rh, inkTol, gapFrac, debugPng)` — see below.
- `FlatCheck`, `FillJpeg`, `ResizeJpeg`, `CropResizePng`, `Md5`.

**There is no extract-and-inpaint path any more.** Every object ships as its
own layer; cutting objects out of backgrounds left visible smudges in v1.

## Word boxes

Caption panels (`PN.jpg`) are clean typeset text on a flat cream band.
Detection (`ImgTool.WordBoxes`): ink = pixels far from the band colour;
lines = humps of the row projection (valleys between them are line breaks —
tight leading means the projection never reaches zero, and a serif face has
two sub-peaks per line, so peaks whose valley stays above 35 % are merged);
words = runs of the column projection over each line's dense core, split on
gaps wider than `gapFrac` × the median core height (0.18); fragments shorter
than 30 % of the line (commas, dots) join the word before them.

The box count **must** equal the word count of the transcription in
`$TEXT` — a mismatch fails the build. Adjust `$GAP['pNN']` for one panel
rather than loosening the global rule, and look at `tools/out/boxes-pNN.png`.
Check live with `index.html?boxes=1`.

## Word timings

Derived once, offline, and committed — never computed at runtime.

The pipeline serves `tools/analyze-audio.js` plus the MP3s (base64) from a
tiny local HTTP listener and opens it in headless Edge, which posts the
result back. (Plain `--dump-dom` with a virtual-time budget cannot wait for
an asynchronous MP3 decode — it dumps first.) The analysis: short-time RMS
(25 ms window, 10 ms hop) in dB → adaptive threshold between noise floor
and peak → speech segments (gaps < 160 ms bridged, blips < 60 ms dropped)
→ words laid along *speech time* in proportion to a weight (syllables +
length) → boundaries within 220 ms of a pause snap to its edges (450 ms
after punctuation) → first word starts with the first sound, last ends
with the last.

Playback reads `audio.currentTime` every frame; the highlighted word is the
last one whose start is ≤ the playhead, so a pause keeps the previous word
lit. If highlighting looks wrong, the bug is in the timings — never "re-sync
with a timer". Look at `tools/out/envelope-pNN.png`, then listen with
`index.html?envelope=1`. If a page reads badly, hand-written timings for
that page only are the documented fallback.

## Verifying the book

```powershell
.\tools\verify.ps1                       # working tree from file://
.\tools\verify.ps1 -Url https://maheshistudy.github.io/a-feijoa-on-monday/
.\tools\verify.ps1 -Bundle               # dist/a-feijoa-on-monday.html
.\tools\verify.ps1 -NoShots              # self-test only
```

It runs `?selftest=1` (report + title), screenshots the cover and every page
into `tools/out/shots/` and one `tools/out/contact-sheet.jpg`, and checks
that a 420 × 860 window shows the rotate prompt. Ends with `VERIFY: PASS`.

The self-test checks: every recording loads and its timings end inside it;
timings are monotonic; both arrows are off during narration; back enables
after it; next stays off until the activity is done, then beckons; page 8's
second panel and stomachache event fire; every image on every page loaded;
back from page 1 reloads page 0 from the top; the ending shows. It runs the
narration as a silent 30× read-along (`FAST`), so it cannot hear anything.

Always do both: read the report **and** look at the contact sheet. Audio
playback, voice quality and sync against the real recording need a human on
a real device — say so rather than claiming it works.

## Common tasks

- **New or replaced artwork** — drop it in the page's `artifacts/`, re-run
  the pipeline, check the printed rectangle, look at the contact sheet.
- **New recording** — drop it in `artifacts/voice/`, re-run (without
  `-SkipAudio`), check `envelope-pNN.png`, listen with `?envelope=1`.
- **Caption text changed** — update `$TEXT` in the pipeline to the new
  typeset text exactly; the count check will tell you if they disagree.
- **Sprite in the wrong place** — the measured box is authoritative; if it
  looks wrong the sheet probably has a stray mark. Ask for a clean sheet.
