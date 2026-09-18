# Content / authoring guide (not part of the live site)

This folder holds the page-by-page script, interaction notes, and source
artifacts for the story, kept separate from the files that actually run the
book (`index.html`, `css/`, `js/`, `assets/`).

**This folder is intentionally excluded from the GitHub Pages build** (see
`.github/workflows/deploy.yml`), so nothing here ever becomes a public URL.
It exists purely so artifacts and instructions can be dropped in and worked
on without touching the live page.

## Structure

```
content/
  project-info/                  <- book-wide notes: brief, build guide, v2 plan,
                                     credits, anything not tied to one page
  pages/
    00-cover/                    <- title card ("A Feijoa on Monday")
      guide.md                     interaction spec + narration text
      artifacts/                   the artwork for this page
        voice/                     the recorded narration for this page
    01-egg-on-leaf/               <- real page 1
    02-egg-hatches/                <- real page 2
    ...
    12-butterfly/                       <- real page 12 (ending)
```

Anything that applies to the whole book rather than one screen — the
assignment brief, an AI-use log, credits, general character/style notes —
goes in `content/project-info/` as plain `.md`/`.txt` files, not inside a
page folder.

Each `pages/NN-slug/` folder is one screen, numbered by its **real** page
number: `00` = cover/title, `01`–`12` = the 12 story pages. That's 13
folders total — front page + 12 pages, matching the story exactly. Each
`guide.md` has the interaction spec (Object/Tap/Animation/Sound/Voice/Next)
plus the matching narration text.

## Artwork conventions

Every page's artwork goes in `artifacts/`, drawn on a 3508 × 2480 sheet with
**each object in the exact position it occupies on the finished page**. The
pipeline measures those positions, so a layer that is moved on its sheet
moves on the page. Within a page:

| File | What it is |
|---|---|
| `*-still-image.jpg` / `*-stillimage.jpg` | the background, with every separately-supplied object removed |
| `PN.jpg` | the narration caption, typeset by the designer on its cream band |
| `<object>.jpg` | one object on white — egg, fruit, caterpillar, cocoon, number, word |
| `*-hole*.jpg` / `*-bite.jpg` | the same object after it has been eaten, used to mask the bite |
| `Forward-arrow.jpg`, `Backward-arrow.jpg` | the page-turn buttons, identical on every page |
| `Tap.png` | the pointing hand used to hint the next tap |

If an object needs to move, animate or disappear, it must be supplied as its
own layer with the background clean behind it — the pipeline no longer cuts
objects out of backgrounds, because doing so leaves visible smudges.

## Recorded voice

Each page's recordings live in `artifacts/voice/`:

- `narration-page_N.mp3` — the whole page read aloud. One per page; the
  caption's words are highlighted in time with it.
- `number_<word>.mp3` — the page's number, played when the child taps the
  drawn numeral.
- `<thing>.mp3` — a single object's name (`feijoa.mp3`, `lamington.mp3`),
  played when the child taps that object.

Filenames are taken as given; a few contain typos (`boysonberry`,
`numer_five`, `cocktail_sousage`) which the pipeline corrects on output
rather than renaming at source.

`tools/build-assets.ps1` reads all of the above and writes processed art to
`assets/img/`, audio to `assets/audio/`, and the measured positions, word
boxes and word timings to the generated `js/layout.js`.

## Note on the source numbering

The original tap/animation guide document has a typo: two entries were both
labelled "Page 2" (egg-hatching, then Feijoa). Because of that duplicate,
every page number after it in that document is one lower than the page it
actually describes (its "Page 3" is really page 4, its "Page 8" is really
page 9, and so on). Each `guide.md` states the **real** page number first,
and notes the document's original (off-by-one) label for traceability. The
real numbering is the one confirmed by the artifact filenames already
copied into each `artifacts/` folder (e.g. `Page3-...jpg` in `03-feijoa/`).

The guide document's trailing "Page 12" entry (egg / "Hello, little
caterpillar!") was a duplicate left over from drafting and has been
removed — it didn't correspond to anything in the 12-page story.
