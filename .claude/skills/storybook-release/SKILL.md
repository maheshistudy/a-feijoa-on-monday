---
name: storybook-release
description: Bundle, deploy and release the Feijoa storybook — build the standalone offline .html and .zip with tools/bundle.ps1, verify they run from file://, and work with the GitHub Actions workflow that deploys to Pages and updates the rolling "latest" release. Use when changing the bundler or the CI workflow, when the downloadable book is broken or stale, when a deploy fails, or when checking a release artifact.
---

# Bundling, deploying and releasing

Read `CLAUDE.md` and `content/project-info/v2-plan.md` §13 first.

Two things ship from every build: the live GitHub Pages site, and a
standalone copy of the book that a non-technical reader can download and
open with no tools, no server and no internet.

## Do not commit or push

The author commits and pushes; CI does the rest. Build locally, verify, and
hand over — do not run `git commit`, `git push`, or merge, and do not create
releases by hand. If something needs to land, say what to commit.

## The bundles

| Artifact | What it is |
|---|---|
| `a-feijoa-on-monday.html` | the whole book inlined into one file — art, audio, code. Double-click to run. |
| `a-feijoa-on-monday.zip` | the site as a folder — unzip, open `index.html`. Smaller and faster to open. |

```powershell
.\tools\bundle.ps1            # writes both into dist/
```

Written in PowerShell so the same script runs locally on Windows and on the
Linux CI runner via `pwsh`. It only does text and base64 — no image
libraries — so it is genuinely cross-platform, unlike the asset pipeline.

## The `file://` rule

**The bundle must run from `file://`.** That forbids `fetch` and `XHR` for
anything the book needs to start: page data ships as `js/layout.js` and
`js/story.js`, plain scripts, never JSON fetched at runtime. The service
worker just doesn't register on `file://`, which is fine — the bundle is
already offline.

This breaks silently and only when opened from disk, so always smoke-test
the bundle itself, not just the site:

```powershell
.\tools\verify.ps1 -Bundle -NoShots     # loads dist/a-feijoa-on-monday.html from file:// with ?selftest=1
```

`tools/verify.ps1` prints the in-page report and ends with `VERIFY: PASS` or
`VERIFY: FAIL`. CI runs the same check with headless Chrome on Linux.

Also open it by hand once per release and listen — headless testing cannot
tell you whether the recordings actually play or stay in sync.

## The workflow

`.github/workflows/build.yml`:

| Trigger | Build | Artifact on the run | Pages deploy | Release |
|---|---|---|---|---|
| Pull request | yes | yes | no | no |
| Push to `main` | yes | yes | yes | updates `latest` |
| Manual dispatch | yes | yes | yes | updates `latest` |

- A pull request builds both bundles and attaches them to the run, so the
  book can be tried on a real device before merging. Nothing is published.
- A merge to `main` deploys to Pages and updates a rolling Release tagged
  `latest`, so the download link never changes.
- The headless self-test runs in CI against both the site and the bundle. A
  failing self-test fails the `build` job, so nothing deploys and no release
  is touched. Jobs: `build` (bundle, self-test, attach artifact
  `a-feijoa-on-monday`, stage `_site`), `deploy` (Pages), `release` (moves the
  `latest` tag, creates or edits the release, uploads both files with
  `--clobber`).

Repo settings: **Pages source must be "GitHub Actions"** (Settings → Pages),
not "Deploy from a branch". Without it `configure-pages` fails with
`Get Pages site failed … Not Found`. The workflow needs `contents: write`
for the release plus `pages: write` and `id-token: write` for the deploy.

## Why `assets/` is committed

The image pipeline uses `System.Drawing`, which is Windows-only and
unsupported on the Linux runners, so CI cannot regenerate the artwork. CI
only bundles, deploys and releases; building art is a local step whose
output is committed. This is deliberate — don't "fix" it by moving the asset
build into CI without moving to a Windows runner.

## Release notes

Keep the body short and non-technical — the audience is a parent or teacher:

> **A Feijoa on Monday** — download `a-feijoa-on-monday.html` and
> double-click it. It opens in your web browser and works offline, on a
> laptop, tablet or phone. Turn the sound on and hold a phone sideways.

## When a deploy fails

1. Read the failing step's log before changing anything.
2. `configure-pages` failing with `Not Found` → the Pages source setting.
3. Self-test failing → a real breakage; fix the book, not the workflow.
4. Bundle smoke test failing but the site passing → something now needs
   `fetch`, or an asset path went absolute. Check `file://` assumptions.
