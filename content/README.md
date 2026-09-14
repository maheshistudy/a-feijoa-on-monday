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
  project-info/                  <- book-wide notes: brief, credits, AI-use statement,
                                     style/character notes, anything not tied to one page
  pages/
    00-cover/                    <- title card ("A Feijoa on Monday")
    01-egg-on-leaf/               <- real page 1
    02-egg-hatches/                <- real page 2
    03-feijoa/                      <- real page 3
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
plus the matching narration text. Drop artifacts (images, audio, etc.) for
that page straight into its `artifacts/` subfolder — nothing here is wired
into `js/story.js` yet, that's a separate step once content is in place.

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
