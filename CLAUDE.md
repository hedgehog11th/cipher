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

- `index.html` contains both the old prototype (`#app`, driven by `script.js` with global `onclick` handlers; left unchanged) and the question bank root `#v1-root`. `js/app.js` routes on the hash: `#/questions` and `#/question/<id>` render the question bank and add `html.v1`; any other hash shows the prototype.
- **Data access is separate from the views.** `js/data.js` is the only module that fetches anything (`loadIndex`, `loadQuestion`, `assetURL`). It caches requests and throws `DataError` with readable messages. The views are `js/list-view.js` and `js/question-view.js`, built with the helpers in `js/dom.js`.
- **Data text is never inserted as HTML.** `rich()` only turns `b i u sub sup br` into elements. `build_data.py` rejects any other tag.
- The script.js prototype declares a global `let history`, so modules must use `window.history`.
- CSS: the prototype rules come first in `styles.css`. The question bank section at the end uses `--cx-*` variables and `.cx-*` classes, scoped under `html.v1` where it overrides globals. Fonts (Courier Prime, Libre Baskerville, OFL) are self-hosted in `assets/fonts/`.

## Data model (see authoring/README.md for the authoring rules)

- One folder per paper: `data/<subject>/<paperId>/`, e.g. `9700_m26_42`. It holds `paper.json`, plus `qNN.json` files and `figures/`.
- One file per **whole question** (`q03.json` = Question 3 with all parts). A sub-part is never a separate question. Question id = `<paperId>_q<number>`.
- Parts nest through `parts`. Keys are dotted (`b.i`). Marks and the mark scheme sit only on leaf parts. Every leaf part must have `markScheme`, `topics` (exactly one primary; refs like `16.2(6)` from `data/syllabus/9700_2025-2027.json`), `er` (ids of verbatim ER comments in the same file, may be `[]`), and `aiSupplement` (`explanation`, `reasoningChain`, `inferredMistakes` with `basis: "inferred"`; `refs` like `ms:c#3` or `syllabus:19.1(9)`).
- Paper-wide ER comments live in `paper.json` and are shown as context only.
- `data/index.json` is generated (list rows, topics de-duplicated per question). Never edit it by hand.
- Only `review.status: "approved"` questions are listed.
- Source PDFs, page renders and extraction tools live outside the repo in `E:\Cipher-materials\` and are never copied into the site.
