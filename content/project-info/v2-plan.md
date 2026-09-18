# v2 implementation plan — recorded voice, designer captions, back navigation

Branch: `feature/recorded-voice`. Nothing in this plan is built yet; this is
the agreed design, written down before any code changes.

The headline change: the book stops generating anything of its own. The
voice is a real recording, the caption is the designer's own artwork, and
every object is a supplied layer. The engine's job shrinks to placing,
timing and gating.

---

## 1. What changed in the source material

| Area | v1 (live now) | v2 (this branch) |
|---|---|---|
| Voice | Web Speech API, synthetic female voice | 34 MP3s recorded by the author's 8-year-old son |
| Caption | HTML text in a styled bar, engine-typeset | `P1.jpg`–`P12.jpg`, the designer's own typeset panels |
| Word highlight | Driven by speech-synthesis boundary events | Must match each recording's real rhythm |
| Navigation | Forward arrow only | Forward **and** back arrow, supplied as artwork |
| Objects | Several cut out of backgrounds by script, gaps digitally filled | Every object supplied as its own layer; backgrounds already clean |

The last row matters most: **v2 needs no inpainting at all.** Every faint
smudge in the current live build came from filling the gap behind an object
the script had to cut out. Pages 1, 2, 9, 10 and 11 now ship clean
backgrounds plus separate object layers, so that whole class of artefact
disappears.

---

## 2. Decisions locked with the author

1. **Caption placement** — each `PN.jpg` is composited at exactly the
   position it occupies on its source sheet. The positions vary per page
   (P3 sits at 4.6% from the top, P2 at 74%, most around 20–25%) because
   the designer placed each caption clear of that page's artwork. The
   engine honours that and never re-flows it.
2. **Page 8** — `p8-1.jpg` and `p8-2.jpg` are the two halves of one
   29-second narration. The first shows, then cross-fades to the second when
   the recording reaches "One Gummybear"; word highlighting runs
   continuously across both.
3. **Sound effects** — the synthesized effects stay, at reduced volume, and
   duck further while narration is playing. The recorded voice always wins.
4. **Word timing** — derived automatically from each MP3's audio envelope.
   No hand-tuning tool; each page is verified visually instead.
5. **Back button** — returning to a page replays it in full: narration from
   the start, activities reset.
6. **Phone in portrait** — a friendly "turn your device" screen; the book
   plays in landscape only.

---

## 3. Asset map

Source files stay untouched under `content/pages/`. The pipeline writes
normalised copies into `assets/`. Filename typos in the recordings
(`boysonberry`, `numer_five`, `cocktail_sousage`) are corrected on the way
out, never renamed at source.

### Backgrounds

| Page | Source | Output |
|---|---|---|
| cover | `00-cover/FrontPage-still.jpg` | `bg-cover.jpg` |
| 1 | `01-egg-on-leaf/Page1-still-image.jpg` | `bg-p01.jpg` |
| 2 | `02-egg-hatches/Page2-still-image.jpg` | `bg-p02.jpg` |
| 3–7 | `0N-*/PageN-still-image.jpg` | `bg-p03.jpg` … `bg-p07.jpg` |
| 8 | `08-saturday-treats/Page_8-background.jpg` (flat sky) | `bg-p08.jpg` |
| 9 | `09-swan-leaf/Page_9-stillimage.jpg` | `bg-p09.jpg` |
| 10 | `10-full-caterpillar/Page_10-stillimage.jpg` | `bg-p10.jpg` |
| 11 | `11-cocoon/Page_11-stillimage.jpg` | `bg-p11.jpg` |
| 12 | `12-butterfly/Page_12-cocoon.jpg` | see note below |

Backgrounds are resized to 1754 × 1240 (half the 3508 × 2480 sheet) at
JPEG q84 — the size the current build already proved sharp on an iPad.

**Page 12 note:** no separate still was supplied; `Page_12-cocoon.jpg` is a
flat sky with the branch and cocoon on it. At build time the pipeline
measures the sky's uniformity. If it is flat (expected), the branch and
cocoon are keyed off it into a sprite and the background becomes the
sampled flat sky, so the cocoon can crack on tap. If it is not flat, the
image is used as the background unchanged and the cocoon stays static — a
build-time check decides, and it is reported in the build log.

### Objects

| Page | Source | Output | Placed at (sheet px) |
|---|---|---|---|
| 1 | `Page1-egg.jpg` | `egg-p01.png` | 1173, 1100 · 241 × 348 |
| 2 | `Page2-egg.jpg` | `egg-p02.png` | 1618, 1148 · 430 × 571 |
| 2 | `Page2-egg cracked.jpg` | `egg-cracked-p02.png` | measured at build |
| 2 | `Page2-caterpillar out.jpg` | `hatched-p02.png` | measured at build |
| 3–7 | `PageN-whole-fruit` / `-full-fruit` | `fruit-<name>.png` | measured |
| 3–7 | `PageN-hole-fruit` | `fruit-<name>-hole.png` (bite mask) | same box |
| 3–7 | `PageN-number*.jpg` | `num-1.png` … `num-5.png` | measured |
| 3–7 | `PageN-word.jpg` | `word-<name>.png` | measured |
| 8 | `Page_8-caterpiller.jpg` | `cat-p08.png` | 1168, 895 · 997 × 482 |
| 8 | `Page_8-full-food.jpg` | `food-<name>.png` × 10 | grid cells |
| 8 | `Page_8-food-hole.jpg` | `food-<name>-hole.png` × 10 | same boxes |
| 9 | `Page_9-caterpiller.jpg` | `cat-p09.png` | 1513, 1130 · 939 × 667 |
| 9 | `Page_9-bite.jpg` | `leaf-bitten-p09.png` | 66, 1095 · 3318 × 775 |
| 10 | `Page_10-caterpiller.jpg` | `cat-p10.png` | 916, 363 · 1919 × 1508 |
| 11 | `Page_11-cocoon.jpg` | `cocoon-p11.png` | 1548, 0 · 1960 × 1457 |
| 12 | `Page_12-butterfly.jpg` | `butterfly-p12.png` | 1146, 778 · 1362 × 866 |

### Caption panels

| Page | Source | Output |
|---|---|---|
| 1–7, 9–12 | `PN.jpg` | `text-p01.png` … `text-p12.png` |
| 8 | `p8-1.jpg`, `p8-2.jpg` | `text-p08a.png`, `text-p08b.png` |

Each is cropped to its cream band and placed at the position measured on its
sheet — see §2.1. The cover has no caption panel.

**Page 9's bite** needs one build-time trick. The whole leaf lives in the
background, so masking a hole in it would reveal the leaf again rather than
sky. Instead `leaf-bitten-p09.png` is built as the bitten leaf composited
over a sky-coloured copy of the original leaf's silhouette (slightly
dilated). Overlaying that single sprite completely covers the original leaf
and shows sky through the bite. Because page 9's sky is flat, the seam is
invisible, and a plain opacity fade is all the engine needs.

### Chrome, shared across pages

| Source | Output | Placed at |
|---|---|---|
| `*/Forward-arrow.jpg` (identical on every page) | `arrow-next.png` | 3117, 2055 · 358 × 388 |
| `*/Backward-arrow.jpg` (identical) | `arrow-back.png` | 37, 2047 · 358 × 390 |
| `*/Tap.png` (identical) | `tap-hand.png` | moved to whatever needs tapping |
| `00-cover/FrontPage-arrow.png` | `cover-arrow.png` | 2121, 1357 · 257 × 278 |
| `00-cover/FrontPage-point.jpg` | same as `tap-hand.png` | 2248, 1519 |
| `00-cover/FrontPage-still.jpg` (crop) | `icon-192.png`, `icon-512.png` | — |

Both arrows are already drawn in their final corners — bottom-right and
bottom-left — so the engine places them at their measured positions rather
than inventing a layout.

### Audio

Copied to `assets/audio/` and renamed canonically:

| Source | Output |
|---|---|
| `00-cover/voice/narration-front_page.mp3` | `cover-narration.mp3` |
| `NN-*/voice/narration-page_N.mp3` | `p01-narration.mp3` … `p12-narration.mp3` |
| `03-feijoa/voice/number_one.mp3` | `p03-number.mp3` |
| `03-feijoa/voice/feijoa.mp3` | `p03-word.mp3` |
| …pages 4–7, including `numer_five` → `p07-number.mp3` and `boysonberry` → `p07-word.mp3` | |
| `08-*/voice/<treat>.mp3` × 10, incl. `cocktail_sousage` | `p08-food-<name>.mp3` |

Total: 34 files, roughly 3.6 MB — small enough to precache for offline use.

---

## 4. Build pipeline

`tools/build-assets.ps1` is rewritten. It keeps the existing
`tools/ImgTool.cs` primitives (white-keying, auto-crop, bite-hole detection)
and **drops the extract-and-inpaint path entirely** — no longer needed.

Stages:

1. **Backgrounds** — resize, encode, report.
2. **Sprites** — key white, auto-crop, record position, emit PNG at half size.
3. **Bite masks** — for fruit and treats, detect the hole positions in the
   `-hole` sheet so each fruit becomes its own tappable cell (already proven
   in v1).
4. **Page 9 / page 12 composites** — as described above.
5. **Caption panels** — crop the cream band, emit PNG, and run word-box
   detection (§5).
6. **Audio** — copy and rename; run timing analysis (§6).
7. **Emit `js/layout.js`** — a generated, committed file holding every
   measured rectangle, every word box and every word timing. `js/story.js`
   stays hand-written for narrative and interaction and refers to layout
   entries by id. This replaces v1's error-prone habit of pasting measured
   numbers in by hand.

The pipeline must stay re-runnable: delete `assets/`, run it, get an
identical tree.

---

## 5. Word-box detection

Each caption panel is clean typeset text on a flat cream band, which makes
this tractable without any OCR:

1. Crop to the band, then threshold ink against the band colour.
2. Horizontal projection → split into text lines on empty rows.
3. Per line, vertical projection → runs of ink columns.
4. Merge runs into words: a gap wider than ~1.5× the line's median gap is a
   word break; anything narrower is letter spacing. Punctuation stays
   attached to the word it follows.
5. Emit boxes in reading order as percentages of the panel.
6. **Validate**: the box count must equal the word count of that page's
   story text. Any mismatch fails the build loudly, with a per-page gap
   threshold available as an override.

Verification: the pipeline writes a debug image per page with the detected
boxes drawn on, and `index.html?boxes=1` draws them live in the browser.

---

## 6. Audio timing analysis

Word timings are derived offline, once, and committed — the book never does
this work at runtime.

1. A local analysis page decodes each narration MP3 with
   `decodeAudioData` in headless Edge.
2. Compute short-time RMS over ~10 ms hops and smooth it.
3. Pick an adaptive noise floor, then segment into speech runs and pauses.
4. Map words onto segments: where the segment count matches the word count,
   one-to-one. Otherwise, distribute the words within each segment weighted
   by length and vowel-group count, with segment edges as hard anchors.
5. Trim leading silence so the first word lights exactly as the voice starts.
6. Write `{start, end}` per word into `js/layout.js`.

**Playback sync is driven by `audio.currentTime`, not a timer.** The
highlight position is recomputed every animation frame from the actual
playhead, so it cannot drift, and a stall or a slow device simply pauses the
highlight rather than desynchronising it.

For page 8, the index of the word "One" (of "One Gummybear") becomes the
panel-swap point; its start time triggers the cross-fade.

Single-word recordings (fruit names, numbers, treats) need no timings — they
play whole on tap.

---

## 7. Engine and interaction model

### Page lifecycle

Every page runs the same state machine, entered identically whether the
child arrived forwards, backwards, or by replay:

1. **Settle** — background and sprites placed, both nav buttons visible but
   disabled and quiet.
2. **Narrate** — narration plays; words highlight in the caption panel.
   Tapping the caption restarts the narration.
3. **Invite** — narration ends. If the page has activities, the activity
   objects begin their idle invitation (§ below). The **back** button
   enables now (quietly — a child must always be able to retreat), the
   forward button stays disabled.
4. **Complete** — all activities done. Activity invitations stop; the
   forward arrow enables and begins beckoning. Exactly one thing is
   inviting a tap at any moment.

The cover is the exception: no caption panel, no back button; the narration
plays and the Start arrow is the only target.

### Attention and affordance rules

Aligned with how established children's picture-book apps handle a
pre-literate audience:

- **One target at a time.** Never highlight the forward arrow and an unfinished
  activity simultaneously.
- **Disabled means invisible-ish, not broken** — dimmed and unresponsive,
  never an error state or a shake-to-refuse.
- **Invitation is gentle and periodic**, not constant: a soft glow that
  breathes, plus a wiggle every few seconds of inactivity, plus the
  designer's own pointing-hand image moved to the target after ~5 seconds.
- **Every tap is answered** within 100 ms by something visible (a sparkle,
  a squash, a pop) even when its main effect is slower.
- **Nothing is ever a dead end** — the back button rescues a stuck child,
  and the caption is always re-playable.
- **Tap targets are large**: the supplied arrows are ~358 px on a 3508 px
  sheet ≈ 10% of width, comfortably past the 44–48 px minimum on every
  target device.
- **Motion is minimal and slow.** Additional effects stay subtle so the
  drawings, not the animation, carry the page.

### Per-page activities

| Page | Activity | Completion |
|---|---|---|
| cover | tap Start | — |
| 1 | tap the egg (it shakes) | one tap |
| 2 | tap the egg three times → cracks → caterpillar emerges | sequence ends |
| 3–7 | bite each fruit once; number and word are tappable to hear them | all fruit bitten |
| 8 | bite each of the ten treats | all ten bitten |
| 9 | tap the leaf → bite appears; caterpillar reacts | one tap |
| 10 | tap the caterpillar → gentle reaction | one tap |
| 11 | tap the cocoon → it sways | one tap |
| 12 | tap the cocoon → butterfly emerges and flies | flight ends |

Tapping a number or fruit-word plays that recording; these are optional and
never gate the forward arrow.

**Page 8** is now fully layered — a flat sky background with the caterpillar
as its own sprite — so when the narration reaches "That night he had a
stomachache!" the caterpillar can slump and turn a little queasy as the
second caption panel appears.

### Audio manager

- One narration channel, one effects channel.
- Effects sit at reduced gain and duck to roughly a quarter while narration
  plays.
- Mute silences both; the button state persists for the session.
- Audio unlocks on the first tap (the cover's Start), as browsers require.
- The next page's audio and images preload while the current page plays.

---

## 8. Responsive and device support

- The stage keeps the 3508 × 2480 ratio and is centred and letterboxed,
  sized `min(100vw, 100vh × ratio)` — it fills a laptop, an iPad and a
  landscape phone without any layout reflow, because every position is a
  percentage of the sheet.
- **Portrait phones** get a full-screen rotate prompt using the book's own
  artwork; the book resumes exactly where it was on rotation.
- Touch and mouse both supported; `touch-action` locked to prevent
  double-tap zoom and rubber-banding.
- Keyboard support for laptops: left/right arrows for pages, Enter/Space to
  activate the focused target, visible focus rings.
- `prefers-reduced-motion` collapses the decorative animation while keeping
  the highlight and the state changes.
- Offline: the service worker precaches all art and all 34 recordings.

---

## 9. Verification

Extending the `?selftest=1` harness that already walks the book headlessly:

1. Every image and every audio file resolves and decodes.
2. Word-box count equals word count, per page.
3. Word timings are monotonic and end within the recording's duration.
4. Each page's forward arrow arms only after its activities complete.
5. The back button returns to the previous page and re-runs it from step 1.
6. Portrait viewport shows the rotate prompt; landscape does not.
7. The run ends on the final page's ending screen.

Plus headless screenshots of all 13 screens for a visual pass, and a repeat
of the whole self-test against the deployed GitHub Pages URL.

Debug switches: `?page=N`, `?boxes=1` (word boxes), `?envelope=1` (audio
envelope against derived timings), `?fast=1`.

---

## 10. Phases

| # | Phase | Output |
|---|---|---|
| 1 | Normalise sources — drop the `Page4-number .jpg` duplicate, confirm the shared arrow/hand files are identical across pages | tidy `content/` |
| 2 | Rewrite `tools/build-assets.ps1`: backgrounds, sprites, bite masks, page 9/12 composites | `assets/img/` |
| 3 | Word-box detection + debug images | boxes in `js/layout.js` |
| 4 | Audio copy/rename + envelope analysis | `assets/audio/`, timings in `js/layout.js` |
| 5 | Engine rewrite: image captions, highlight overlay, audio-driven sync, back/forward gating, replay-on-entry | `js/app.js`, `js/story.js` |
| 6 | UX pass: invitation states, hand hints, rotate prompt, keyboard, reduced motion | `css/style.css` |
| 7 | Self-test extension + screenshots + fixes | green self-test |
| 8 | `tools/bundle.ps1` + `file://` smoke test; delete `build-single-file.py` | two offline bundles |
| 9 | `.github/workflows/build.yml`: PR build, Pages deploy, rolling release; refresh `README.md` to describe v2 behaviour | CI green |
| 10 | Hand over for commit; after merge, verify the live site and the release download | live site + release |

Phases 1–9 are all local. **Nothing is committed or pushed by me** — the
author commits, opens the pull request and merges; the workflow does the
rest. Phase 10 is verification after that has happened.

## 11. Risks

- **Word segmentation on tight typesetting.** Mitigated by the per-page
  threshold override and a hard build-time count check, so a bad split can
  never ship silently.
- **Timing accuracy on a child's natural speech** — uneven pace and breaths
  make the envelope ambiguous. Mitigated by anchoring to pauses and by
  driving from `currentTime`; each page gets a visual check. If a page
  reads poorly, the fallback is hand-written timings for that page only.
- **Autoplay policy.** No audio can play before the first tap; the cover's
  Start button is that tap, so page 1 narrates freely.
- **Page 12's flat-sky assumption** — checked at build time with a
  documented fallback.
- **Total asset weight** with 34 recordings plus art; budget stays under
  ~12 MB, verified before deploy.

## 12. Still open

- No recorded word for the swan-plant leaf on page 9, or for "butterfly" on
  page 12 — those pages have narration only, which is fine, but a word
  recording would make them consistent with pages 3–8.
- `content/pages/04-tamarillo/artifacts/Page4-number .jpg` (trailing space)
  is a byte-identical duplicate of `Page4-number.jpg`; dropped in phase 1.

---

## 13. Distribution: automatic deploy and downloadable book

Two outputs from every build: the live site, and a standalone copy of the
book that runs with no tools, no server and no internet.

### What gets produced

| Artifact | What it is | Size |
|---|---|---|
| `a-feijoa-on-monday.html` | the entire book inlined into one file — art, audio, code | ~16 MB |
| `a-feijoa-on-monday.zip` | the site as a folder: unzip, open `index.html` | ~12 MB |

Both run by double-clicking, on any modern browser, on laptop, tablet or
phone, offline. The single `.html` is the one the README points at because
there is nothing to explain; the `.zip` is there because it loads faster and
is gentler on older devices.

**`file://` compatibility is a hard requirement** for these bundles. The
engine must therefore avoid `fetch`/`XHR` for anything it needs to run —
page data ships as `js/layout.js` and `js/story.js` (plain scripts), never
as JSON fetched at runtime. The service worker simply doesn't register on
`file://`, which is fine; the bundle is already offline. This constraint is
worth keeping in mind during the engine rewrite (§7) — it is easy to break
accidentally and only shows up when the bundle is opened from disk.

### The bundler

`tools/bundle.ps1` — PowerShell, so the same script runs locally on Windows
and in CI on Linux via `pwsh` (pre-installed on GitHub runners). It needs no
image libraries, only text and base64, so unlike the asset pipeline it is
fully cross-platform.

It inlines the CSS, the three scripts, every image as a `data:` URI, and
every MP3 as a `data:` URI, strips the manifest, icon and service-worker
registration, and writes the single file. The ZIP is the same source tree
minus `content/`, `tools/`, `.claude/` and the dot-files.

The existing root-level `build-single-file.py` is v1's bundler, predates the
audio and `layout.js`, and requires Python (which this machine doesn't
have). It is replaced by `tools/bundle.ps1` and deleted.

### Workflow

One workflow, `.github/workflows/build.yml`, replacing the deploy-only one:

| Trigger | Build | Downloadable artifact | Pages deploy | Release |
|---|---|---|---|---|
| Pull request | yes | attached to the run | no | no |
| Push to `main` | yes | attached to the run | yes | updates `latest` |
| Manual dispatch | yes | attached to the run | yes | updates `latest` |

- **On a pull request** the workflow builds both bundles and attaches them
  with `actions/upload-artifact`, so the book can be downloaded and tried on
  a real device before anything is merged. Nothing is published.
- **On merge to `main`** the same build runs, the site deploys to GitHub
  Pages exactly as it does today, and a rolling Release tagged `latest` is
  updated with both bundles — so the download link never changes.

**The built `assets/` stay committed to git.** The image pipeline depends on
`System.Drawing`, which is Windows-only and unsupported on the Linux
runners, so CI cannot regenerate the artwork. CI only bundles, deploys and
releases; regenerating art is a local step whose output is committed. This
is already how the repo works — it is written down here so it doesn't look
like an oversight later.

### Release notes for the reader

The Release body is generated by the workflow and kept to a few lines, for
someone with no technical background:

> **A Feijoa on Monday** — download `a-feijoa-on-monday.html` and
> double-click it. It opens in your web browser and works offline, on a
> laptop, tablet or phone. Turn the sound on and hold a phone sideways.
> (`a-feijoa-on-monday.zip` is the same book as a folder — unzip it and open
> `index.html` — it opens a little faster.)

### Verification in CI

The self-test runs headlessly in the workflow against the built site, so a
pull request that breaks a page fails before review. The bundle is smoke-
tested the same way — loaded from `file://` in headless Chrome with
`?selftest=1` — which is the only way to catch a `fetch` sneaking in and
breaking offline use. A build whose self-test fails produces no release.

---

## 14. Implementation notes (2026-09-18)

Phases 1–9 are built and verified locally; nothing is committed. What
differs from the plan above, and what to know before merging:

- **Pipeline** — `tools/build-assets.ps1` runs in about a minute and
  produces 85 images, 33 recordings and `js/layout.js` (18 KB). Word-box
  detection matched the transcription on all 13 panels without a per-page
  override. The audio analysis runs in headless Edge behind a tiny local
  HTTP listener, because `--dump-dom` with a virtual-time budget cannot
  wait for an asynchronous MP3 decode. `-SkipAudio` reuses the committed
  timings for an image-only rebuild.
- **Page 12** was measured flat (0 % off-colour), so the branch and cocoon
  are lifted off and the cocoon can crack; `LAYOUT.flags.p12Layered` records
  the decision and `story.js` carries the static fallback.
- **Saturday treats** come on a 5 × 2 contact sheet, not in page positions,
  so `story.js` lays them out in two rows: above the caption panel and below
  the caterpillar, clear of both arrows.
- **Overlaps in the designer's own placement**, left exactly as drawn:
  page 3's panel sits over the top of the "Feijoa" word and the "1"; page 4's
  panel clips the "Tamarillo" word; page 8's second panel covers the
  caterpillar's antennae. Worth a look by the designer; the engine will
  follow whatever positions the next sheets carry.
- **Verification** — `tools/verify.ps1` (self-test + contact sheet + rotate
  prompt) passes for the working tree and for the offline bundle from
  `file://`. The self-test drives the narration as a silent 30× read-along,
  so audio playback and sync are **not** verified by it — that needs a
  person on a real device, ideally an iPad.
- **Bundles** — `tools/bundle.ps1` writes `dist/a-feijoa-on-monday.html`
  and `.zip`; the engine resolves every asset path through `asset()`, which
  the bundle points at a `data:` URI map, so no `fetch` is involved anywhere.
- **Workflow** — `.github/workflows/build.yml` replaces `deploy.yml`:
  `build` (bundle, self-test site and bundle in headless Chrome, attach the
  artifact `a-feijoa-on-monday`), then on `main` only `deploy` (Pages) and
  `release` (moves the `latest` tag, edits or creates the release, uploads
  both files). `build-single-file.py` is deleted.
- **Phase 10** is yours: commit, open the pull request (the run attaches the
  two downloads), merge, then `.\tools\verify.ps1 -Url <pages url>` and
  download the release file and open it.
