# Pip's Big Garden Munch — interactive storybook

A tap-along picture book for 4–5 year olds, built from your own drawings.
No build step, no framework, no npm: plain HTML, CSS and JavaScript that runs
on an Android tablet, iPad, laptop or projector, and installs as a fullscreen app.

## What's in the box

```
storybook/
├── pip-storybook.html      ← ONE-FILE VERSION. Double-click to run. Built by build-single-file.py
├── build-single-file.py    Rebuilds pip-storybook.html from the files below
├── index.html              The page shell (splash, stage, buttons)
├── manifest.webmanifest    Makes it installable ("Add to Home screen") in landscape fullscreen
├── sw.js                   Offline cache so it works on a tablet with no wifi
├── css/style.css           Layout, page-turn, caption, all animations
├── js/story.js             ← THE STORY. Pages, captions, taps, props. Edit this.
├── js/app.js               The engine: renders pages, handles taps, narration, highlighting
├── js/audio.js             Narration (MP3 → falls back to browser speech) + synthesized sound effects
└── assets/
    ├── img/scene-night.jpg Your scene, with the egg lifted out into its own layer
    ├── img/scene-day.jpg   Same drawing recoloured for daytime (sky, hills, sun)
    ├── img/egg.png         Your egg, transparent background — it wobbles and hatches
    ├── img/caterpillar.png Your caterpillar, cut out, with a soft fill so it reads on any background
    ├── img/arrow.png       Your green triangle — it is the "next" button
    ├── img/storyboard.jpg  Your annotated storyboard (reference only, not shown in the app)
    ├── img/icon-*.png      App icons
    └── audio/              Empty. Drop MP3 recordings here (see "Recording audio")
```

## Fastest way to see it: the single file

`pip-storybook.html` is the whole book in one file, images included. Double-click it — no server,
no install. It also works emailed, on a USB stick, or dropped onto any web host.
Use **Chrome** (or Edge) for the best result; Safari and Firefox also work.

Rebuild it after editing anything: `python3 build-single-file.py`

## Run the project folder (for development)

The folder version loads separate files, so it needs a local web server (double-clicking
`index.html` in the folder will NOT work — that's the "blank/broken page" symptom).

**Option A — Python (already on most machines)**
```bash
cd storybook
python3 -m http.server 8080
```
Open http://localhost:8080

**Option B — Node**
```bash
cd storybook
npx serve .
```

**Option C — VS Code:** install the "Live Server" extension, right-click `index.html` → Open with Live Server.

Tap **Tap to begin** (this one tap is what unlocks audio on phones and tablets), then tap things.
Keyboard on a laptop: `→` next, `←` back, `space` read again.

To try it on a tablet on the same wifi, find your laptop's IP (`ipconfig` / `ifconfig`) and open
`http://<your-ip>:8080` on the tablet.

## How the book works

- **One page = one scene.** The stage is a fixed A4-landscape box (the ratio of your drawings), so
  everything is positioned in percentages and looks identical on any screen.
- **Narration auto-plays** when a page opens, with word-by-word highlighting in the caption.
  The speaker button replays it.
- **Tappable objects** wiggle every few seconds so the child discovers them. Tapping gives an
  instant reaction: animation + sound + a spoken word + a sparkle burst.
- **Some pages have a task** (hatch the egg, take a bite, count three leaves, grow Pip). The green
  arrow stays faded until the task is done, then the caption changes and the arrow bobs.
- The last page's arrow restarts the book.

## Editing the story — `js/story.js`

Each page is an object. Here is page 4 with comments:

```js
{
  bg: 'day',                     // 'night' or 'day' — which version of your scene
  audio: 'page-04',              // plays assets/audio/page-04.mp3 if it exists, else browser speech
  text: "Pip found a feijoa, green and bumpy. Sniff... nibble... \"Ooh! Too sour!\"",
  items: [
    { id: 'pip',  kind: 'img', src: PIP,           x: 36, y: 62, w: 24, idle: 'breathe',
      tap: { anim: 'wiggle', sfx: 'tap', say: 'Feijoa, please!' } },
    { id: 'food', kind: 'svg', shape: 'feijoa',    x: 60, y: 48, w: 12, idle: 'sway',
      tap: { anim: 'munch', sfx: 'munch', bite: true, required: true,
             say: 'Feijoa! Too sour!', then: 'yuck' } },
  ],
  task: 1,                       // how many "required" taps unlock the arrow (0 = none)
}
```

| Field | Meaning |
|---|---|
| `cam` (page) | `{ zoom, x, y }` — the camera zooms the whole drawing toward point (x, y); every page can have its own framing |
| `x`, `y`, `w` | centre position and width, as **% of the drawing** (the camera zooms them with the scene) |
| `tap.react` | big speech-bubble text; an array gives a different word per tap |
| `tap.lunge` | id of the character that lunges at this object (Pip biting the fruit) |
| `kind: 'img'` + `src` | a PNG/JPG (your drawings). Transparent PNGs work best |
| `kind: 'svg'` + `shape` | one of the flat-colour props in `SHAPES` at the top of the file |
| `idle` | looping motion: `breathe`, `sway`, `flap` |
| `tap.anim` | one-shot: `wobble`, `wiggle`, `munch`, `pop`, `glow`, `shiver`, `flutter` |
| `tap.sfx` / `tap.then` | sound now / sound ~0.6s later: `tap pop wobble munch lick yuck yum ding shimmer whoosh rumble hum flutter count` |
| `tap.say` | a short spoken line (uses `tap.sayFile` MP3 if you add one) |
| `tap.bite` | reveals the bite mark in fruit/leaf shapes |
| `tap.grow` | multiply the object's size on each tap (e.g. `1.25`) |
| `tap.count` | taps needed before it counts as done (default 1) |
| `tap.required` | this tap counts toward the page's `task` |
| `tap.onComplete: 'hatch'` | special: replaces the egg with Pip |
| `after` / `afterAudio` | caption + narration spoken once the task is complete |

**Adding a page:** copy any page object, paste it into the `pages` array where you want it, change
the text and items. The dots at the top update automatically.

**Adding your own drawing as an object:** export it as a PNG with a transparent background
(Procreate: hide the background layer → Share → PNG), drop it in `assets/img/`, and add
`{ id: 'tui', kind: 'img', src: 'assets/img/tui.png', x: 70, y: 30, w: 15, tap: {...} }`.

**Adding a new background:** put a JPG in `assets/img/`, then add a line in `css/style.css` next
to `.bg.day`, e.g. `.bg.beach { background-image: url("../assets/img/beach.jpg"); }` and use
`bg: 'beach'` on the page.

**Drawing new SVG props:** the ones in `SHAPES` are 200×200 viewBoxes with `stroke="#111"
stroke-width="7"` and flat fills, matching your scene. Copy one and change the paths. Keep the
`<mask>` block and `class="bite"` elements if you want it to be bitten.

## Recording audio

The demo works with zero audio files (it uses the browser's built-in voice), but a real recorded
voice — yours, or a child's — is far warmer and is what you should ship. Record with your phone or
Audacity, one clip per line, export MP3, and drop them into `assets/audio/` with these names:

| File | Used for |
|---|---|
| `page-01.mp3` … `page-11.mp3` | the caption narration for each page |
| `page-02b.mp3`, `page-08b.mp3`, `page-09b.mp3` | the "after" caption on task pages |
| any name, referenced by `sayFile: 'feijoa'` | the short word spoken when an object is tapped |

Then set `recordings: true` near the top of `js/story.js`. Files take priority over the synthetic voice. (While testing without files you will
see harmless 404s in the browser console — that is the app checking whether an MP3 exists.)

Word highlighting with MP3s spreads the words evenly across the clip, which is close enough for a
storybook. For exact timing, record with Azure Speech (it can return per-word timestamps) or
adjust the split in `Audio.narrate()` in `js/audio.js`.

## Publishing (this is your Assignment 2 evidence)

Any static host works — the whole thing is a folder of files.

**GitHub Pages (free, ~5 min)**
1. Create a repository, upload the contents of `storybook/` to its root.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)` → Save.
3. Your book is live at `https://<username>.github.io/<repo>/`. Put that URL in a QR code for the
   Week 9 presentation.

**Netlify (even faster):** drag the `storybook` folder onto https://app.netlify.com/drop — done.

**Installing on an Android tablet as an app:** open the live URL in Chrome → menu ⋮ →
*Add to Home screen* → *Install*. It opens fullscreen, landscape-locked, and works offline after the
first load thanks to `sw.js`. Same on iPad via Safari → Share → *Add to Home Screen*.

When you change files after publishing, bump `const CACHE = 'pip-v1'` in `sw.js` (e.g. to `pip-v2`)
so tablets fetch the new version.

**Real APK for the Play Store / sideloading (optional):**
```bash
npm i -g @capacitor/cli @capacitor/core @capacitor/android
npx cap init "Pip's Big Garden Munch" nz.yourname.pip --web-dir storybook
npx cap add android && npx cap open android     # then Build → APK in Android Studio
```

## Testing with children (for Assignment 3)

- Use a tablet in landscape, fullscreen, sound on. Sit back and don't help for the first minute.
- Note what they tap first, whether they find the arrow without being told, whether they wait
  for the narration or tap through it, and which sound made them laugh.
- Those observations are exactly what the reflection assignment wants.

## AI disclosure (required by your course brief)

Your brief requires you to state what AI tool you used and how. A truthful statement for this
project:

> The interactive book was built with Claude (Anthropic) from my own drawings, my storyboard and my
> story brief. Claude cut my scene, egg and caterpillar into separate layers, generated a daytime
> recolour of my scene, wrote the HTML/CSS/JavaScript engine, drew the fruit, leaf, chrysalis and
> butterfly props as SVG in the style of my scene, and drafted the story text, which I edited.
> Prompts used: [paste them]. Number of drafts: [n]. No individual creators' names were used in
> prompts.

Keep a copy of your prompts as the brief asks. The story text is original (not adapted from any
published book), so the published project is safe to release publicly.

## Browser notes

- Tested in Chrome. Works in Safari/Firefox; Safari's word highlighting uses a timer instead of
  speech events.
- Google Fonts (Fredoka, Patrick Hand) load from the web; if offline the book falls back to system
  fonts and still works. To bundle the fonts, download them from fonts.google.com and use
  `@font-face` in `style.css`.
- `container-type` / `cqw` units need Chrome 105+, Safari 16+, Firefox 110+ — any tablet from the
  last three years.
