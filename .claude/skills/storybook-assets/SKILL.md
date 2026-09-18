---
name: storybook-assets
description: Build and verify the Feijoa storybook's assets — process the designer's 3508x2480 artwork sheets and recorded MP3s into assets/img, assets/audio and the generated js/layout.js, then verify the result headlessly. Use when artwork or voice recordings are added or changed, when sprite positions or word boxes look wrong, when word highlighting drifts against the recording, or when running the book's self-test and screenshots.
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
not to invent a layout.

## Running the pipeline

```powershell
.\tools\build-assets.ps1
```

It compiles `tools/ImgTool.cs`, clears `assets/img`, and rebuilds
everything, printing one line per asset with its measured rectangle. It must
be re-runnable: delete `assets/`, run it, get an identical tree.

Outputs:

- `assets/img/` — backgrounds (1754 × 1240 JPEG q84) and sprites (PNG, half
  the sheet size, transparent)
- `assets/audio/` — the recordings, renamed canonically
- `js/layout.js` — **generated**; every rectangle, word box and word timing.
  Never hand-edit it; change the pipeline instead.

## Using ImgTool directly

For one-off measuring or debugging:

```powershell
Add-Type -Path "tools\ImgTool.cs" -ReferencedAssemblies System.Drawing
# key white off a sheet, auto-crop, report where it sat
[ImgTool]::KeyCrop("content\pages\01-egg-on-leaf\artifacts\Page1-egg.jpg",
                   "out.png", 0,0,0,0, "white", 6, 24, 0.5, 6, 200)
# -> {"file":"out.png","x":1173,"y":1100,"w":241,"h":348}
```

Key entry points:

- `KeyCrop(src, dst, rx,ry,rw,rh, bgMode, tolHard, tolSoft, scale, pad, minArea)`
  — flood-key the background from the border, auto-crop to content, report
  the box. `bgMode` is `"white"` or `"auto"` (samples the border colour).
- `MaskCrop(fullSrc, holeSrc, dst, bx,by,bw,bh, …)` — build a bite mask and
  report each hole's centre, so a multi-fruit sheet becomes one tappable
  cell per fruit.
- `ResizeJpeg`, `CropResizePng` — plain resampling.
- `ExR/ExG/ExB/ExTol` — a second "background" colour to protect (e.g. a
  branch that must stay behind an object).
- `ClrX/ClrY/ClrW/ClrH` — force a rectangle transparent, for stray
  neighbours caught in a crop.

**Do not use the extract-and-inpaint path.** Every object now ships as its
own layer; cutting objects out of backgrounds leaves visible smudges and is
no longer needed.

## Word boxes

Caption panels (`PN.jpg`) are clean typeset text on a flat cream band.
Detection: threshold ink against the band, horizontal projection to split
lines, vertical projection to split words on gaps wider than ~1.5× the
line's median gap.

The box count **must** equal the word count of that page's story text — a
mismatch fails the build. If a page needs a different gap threshold, add a
per-page override in the pipeline rather than loosening the global rule.

Check visually with `index.html?boxes=1`, which draws the boxes live.

## Word timings

Derived once, offline, and committed — never computed at runtime.

1. Headless Edge loads a local analysis page that decodes each narration
   MP3 with `decodeAudioData`.
2. Short-time RMS (~10 ms hops), smoothed, with an adaptive noise floor.
3. Segment into speech runs and pauses; map words onto segments, anchored at
   segment edges, distributed inside a segment by word length.
4. Trim leading silence so the first word lights as the voice starts.

Playback sync reads `audio.currentTime` every animation frame. If
highlighting drifts, the bug is in the timings or the mapping — never
"re-sync with a timer".

Check with `index.html?envelope=1`, which draws the envelope against the
derived word boundaries.

## Verifying the book

```powershell
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$base = 'file:///<repo path>/index.html'

# full self-test: walks every page, taps everything, asserts, sets the title
Start-Process $edge -Wait -NoNewWindow -ArgumentList @(
  '--headless=new','--disable-gpu','--no-first-run',
  "--user-data-dir=`"$env:TEMP\edge-fj`"",'--window-size=1400,1000',
  '--virtual-time-budget=90000','--dump-dom',"`"$base`?selftest=1`"")
# then grep the dumped DOM for <title>TEST PASS</title> and the
# <pre id="test-report"> contents

# screenshot one page
Start-Process $edge -Wait -NoNewWindow -ArgumentList @(
  '--headless=new','--disable-gpu','--hide-scrollbars',
  "--user-data-dir=`"$env:TEMP\edge-fj`"",'--window-size=1400,1000',
  '--virtual-time-budget=4000','--screenshot="shot.png"',"`"$base`?page=7`"")
```

Always do both: read the self-test report **and** look at screenshots. The
self-test catches missing assets and broken gating; only your eyes catch a
sprite in the wrong place or a caption covering the art.

Audio cannot be verified headlessly — playback, voice quality and sync
against the real recording need a human on a real device. Say so rather
than claiming it works.

After deploying, run the same self-test against the live GitHub Pages URL.

## Common tasks

- **New or replaced artwork** — drop it in the page's `artifacts/`, re-run
  the pipeline, check the printed rectangle, screenshot the page.
- **New recording** — drop it in `artifacts/voice/`, re-run, check the
  derived timings with `?envelope=1`.
- **Sprite in the wrong place** — the measured box is authoritative; if it
  looks wrong the sheet probably has a stray mark. Use `ClrX/ClrY/ClrW/ClrH`
  to exclude it, or ask for a clean sheet.
