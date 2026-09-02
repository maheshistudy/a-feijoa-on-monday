# A Feijoa on Monday

A tap-along interactive picture book for 4–5 year olds, from a windy Wellington garden. All artwork is hand-drawn; the site is plain HTML/CSS/JS with no build step.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000 — or just open `index.html` through any static server. (Opening the file directly with `file://` works too, but the service worker only registers over http/https.)

**Sound notes:** the story is read aloud with the device's built-in voice (Web Speech API), synced to the word highlighting; tap the caption bar to hear a page again. Browsers only allow audio after a first tap — the "Tap to begin" button handles that. On iPads, the hardware silent switch / silent mode mutes web audio, so flip it off for storytime.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (`main` branch).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main`, `/ (root)`.
3. The book will be live at `https://<username>.github.io/<repo>/` within a minute or two. All paths are relative, so it works from a project sub-path without configuration.

## Structure

- `index.html` — shell
- `css/style.css` — stage, atmosphere, animations
- `js/audio.js` — synthesized WebAudio sound effects (no audio files)
- `js/story.js` — page data: text, object positions, interactions, camera (edit this to add pages)
- `js/app.js` — engine: rendering, read-aloud narration (Web Speech API) with synced highlighting, taps, page turns
- `assets/img/` — processed hand-drawn artwork
- `manifest.webmanifest` + `sw.js` — installable PWA, works offline after first visit

## Adding pages

Append a page object to `STORY.pages` in `js/story.js`. Positions use the `px(x, y, w, h)` helper in original scene pixels (1316 × 924). New drawings go in `assets/img/` and should be added to the `PRECACHE` list in `sw.js` (bump the `CACHE` version string when you do).

## Production notes for the assignment log

- Image processing (egg/caterpillar cut-outs, background inpainting, night/day scenes) was done with Python (OpenCV + Pillow) from the original drawings.
- Narration text in `js/story.js` is an original retelling written for this book — keep your own record of any AI assistance per the course's AI-use statement.
