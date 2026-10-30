# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cipher is a static A Level past-paper question bank (first release: CAIE Biology 9700, A2 Paper 4). Plain HTML, CSS and vanilla JavaScript (ES modules), JSON data, no build tool or dependencies. The site is English-only. Content (questions, MS, ER, analysis, topics) is written and reviewed by the owner; development, data import and technical validation are done here.

## Commands

- `python tools/build_data.py`: validate every question file and regenerate `data/index.json`. Exits 1 and writes nothing when there are errors. Messages are in Chinese for the owner.
- `python tools/build_data.py --check`: validate only; also fails if `data/index.json` is out of date.
- `python tools/build_data.py --include-drafts`: also list questions whose `review.status` is `draft`.
- `python tools/serve.py` (or `preview.cmd`): local server on 127.0.0.1:8000 that opens `#/questions`. Use it rather than `python -m http.server`, because Windows can serve `.js` as `text/plain`, which breaks module scripts. Pages must not be opened as `file://`.
- No test runner in the repo. Browser checks were run with headless Chrome against an iframe harness at real widths. Headless Chrome on this machine cannot make the window narrower than about 504px, so phone widths have to be tested inside an iframe.

## Architecture

- `index.html` contains both the old prototype (`#app`, driven by `script.js` with global `onclick` handlers; markup and script left unchanged) and the question bank root `#v1-root`. `js/app.js` routes on the hash: `#/` (home), `#/subject/<slug>` (e.g. `#/subject/biology`), `#/questions?subject=<slug>`, `#/question/<id>`, `#/search?q=` and `#/library` render the question bank and add `html.v1`. There is no more link to the prototype and an empty hash redirects to `#/`, so it has no way in; only an explicit non-`#/` hash (nobody links to one) would still show it.
- **Multi-subject.** `<slug>` is the subject folder name under `data/` (`biology`, `chemistry`, `physics`), also the index's `subject` field. Home lists every subject with a data folder; a subject with none yet (Further Mathematics) is a disabled row. The contents page, search and My Library all read the index's `subject` field to stay on the right subject or span all of them (search/library are deliberately global — question codes are unambiguous across subjects).
- **Data access is separate from the views.** `js/data.js` is the only module that fetches anything (`loadIndex`, `loadQuestion`, `assetURL`). It caches requests and throws `DataError` with readable messages. The views are `js/home-view.js` (Home, the subject page), `js/list-view.js` (the contents page, also used by search and My Library for row rendering), `js/question-view.js`, `js/search-view.js` (full search results; matching logic is in `js/search.js`) and `js/library-view.js` (My Library, listing every tagged question with a tag filter), built with the helpers in `js/dom.js`. `js/app.js`'s masthead also runs a live search dropdown.
- **Tags are a personal, local-only layer, not content.** `js/tags.js` stores free-text tags per question id in `localStorage` (`cipher.tags`), with no preset list and nothing sent anywhere. Tags are added from the question page and shown there and on list/search/library rows via `js/list-view.js`'s `row()`.
- **Data text is never inserted as HTML.** `rich()` only turns `b i u sub sup br` into elements. `build_data.py` rejects any other tag.
- The script.js prototype declares a global `let history`, so modules must use `window.history`.
- CSS: `styles.css` holds the prototype styles and should not be restyled. Question bank styles are in `css/cipher.css`. They use `--cx-*` variables and `.cx-*` classes, scoped under `html.v1` where they override globals.
- **Read `DESIGN.md` before any visual change and `PRODUCT.md` for scope.** They hold the concept ("a marked past paper"), the tokens, the layout of both pages and the don't-list. Keep `css/cipher.css` and DESIGN.md in step.
- Fonts are self-hosted in `assets/fonts/`: Courier Prime and Libre Baskerville (both OFL, from Google Fonts). Textures (`paper.jpg`, `ring.png`) are rendered by `tools/textures/render.py`.
- The list page is the syllabus as a contents page. Each question is listed once under its `home` (chapter plus section, or the chapter's cross-topic group). The home is set in the data, never inferred.
- Design self-check: taste-skill's `inspect.mjs` and its CDP client (`E:\Cipher-reference\taste-skill-main\...\scripts`, Node at `E:\tavern\node`; do not look at anything else under `E:\tavern`). Run them from a temporary folder, never from the repo. Ignore its monospace rule, because the typewriter face is the owner's brand choice.
- Every page starts with `pageHead()` (`js/dom.js`): breadcrumb, then the page name as the h1. A question is always named by its full code (`qid()`, e.g. `9700/42/F/M/26/Q3`). The list page shows only the A Level chapters (12–19).
- Question page: the part label itself is the control. Each part's answer is one panel, in this order: mark scheme, primary topic line, AI supplement, examiner report (original text, no correction notes).
  - At 1024px and above (laptop, iPad landscape), the page has two columns: the question (780px measure) on the left and a sticky reading column on the right that shows the chosen part or "All".
  - Below 1024px the answer opens under the part. Phones are emergency use only; the main targets are computer and iPad.

## Data model (see authoring/README.md for the authoring rules)

- One folder per paper: `data/<subject>/<paperId>/`, e.g. `9700_m26_42`. It holds `paper.json`, plus `qNN.json` files and `figures/`.
- One file per **whole question** (`q03.json` = Question 3 with all parts). A sub-part is never a separate question. Question id = `<paperId>_q<number>`.
- Parts nest through `parts`. Keys are dotted (`b.i`). Marks and the mark scheme sit only on leaf parts. Every leaf part must have `markScheme`, `topics` (exactly one primary; refs like `16.2(6)` from `data/syllabus/9700_2025-2027.json`), `er` (ids of verbatim ER comments in the same file, may be `[]`), and `aiSupplement` (`explanation`, `reasoningChain`, `inferredMistakes` with `basis: "inferred"`; `refs` like `ms:c#3` or `syllabus:19.1(9)`).
- Paper-wide ER comments live in `paper.json` and are shown as context only.
- `data/index.json` is generated (list rows, topics de-duplicated per question). Never edit it by hand.
- Only `review.status: "approved"` questions are listed.
- Source PDFs, page renders and extraction tools live outside the repo in `E:\Cipher-materials\` and are never copied into the site.
