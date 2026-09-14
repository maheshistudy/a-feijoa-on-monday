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
  pages/
    00-cover/
      guide.md       <- Object / Tap / Animation / Sound / Voice / Next, plus the story text for this screen
      artifacts/      <- drop the raw art, audio, etc. for this page here
    01-egg-on-leaf/
    02-egg-hatches/
    ...
```

Each `pages/NN-slug/` folder corresponds to one screen of the book, in story
order (`00` = title/cover, `01` = the front-page egg, `02` = hatching, and so
on through the ending). `guide.md` in each folder has the interaction spec
exactly as provided, plus the matching narration text from the story script.
Drop artifacts (images, audio, etc.) for that page straight into its
`artifacts/` subfolder — nothing here is wired into `js/story.js` yet, that's
a separate step once content is in place.

## Note on the source numbering

The original tap/animation guide and the story script don't share the same
"Page N" numbers (the guide has two entries both labelled "Page 2", and a
trailing "Page 12" — an egg / "Hello, little caterpillar!" beat — that
doesn't correspond to anything in the story script). The folders above are
sequenced by story order rather than by the guide's own labels, and the
guide's original label is preserved verbatim inside each `guide.md` so
nothing is lost. The unmatched trailing entry lives in
`pages/13-unmapped-egg-hello/guide.md` — flagging it for confirmation before
it's wired into the story.
