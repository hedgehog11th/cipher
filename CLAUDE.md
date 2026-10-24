# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static front-end prototype of an exam past-paper practice app (Cambridge A-Level Biology 9700). It's three files with no build step, package manager, tests, or linter: `index.html`, `styles.css`, `script.js`. Open `index.html` in a browser to run it. To serve it locally, use something like `python -m http.server`.

All content is hardcoded mock data. There is no backend or persistence, and state resets when the page reloads.

## Architecture

- **Single-page navigation:** every screen is a `<section class="page" id="page-<name>">` in `index.html`. `navigateTo(name)` in `script.js` swaps the `.active` class and pushes onto a `history` array that `goBack()` and the back button use. Adding a page means adding a `page-<name>` section and calling `navigateTo('<name>')` from an `onclick`. Pages with side effects (`question` resets the answer state, `profile` refreshes the mode label) are special-cased in `navigateTo`. Note that `goBack()` skips those hooks.
- **Inline handlers:** interactions are wired with `onclick="..."` attributes in the HTML, so every handler in `script.js` has to stay a global function. The script is plain ES5 style (`var`, `function`), with no modules.
- **Free/Premium mode:** the `isPremium` flag is flipped by `toggleMode()`. `updatePremiumFeatures()` gates features by setting inline styles on elements like `.premium-btn`, `#libraryGrid`, `#weaknessSection .weakness-list`, `#revisionSection .revision-path` and `.question-tags`. `openPanel()` also refuses to open the `tag`, `attempt` and `similar` panels in free mode. A new premium-only feature needs to be added in both places.
- **Question interaction:** the single question page has options marked with `data-option="A".."D"`, and the answer is the hardcoded `correctAnswer` constant. `selectOption` applies the `selected`/`correct`/`incorrect`/`revealed` classes.
- **Slide panel and tag modal:** one shared `#slidePanel` takes its title and its content from `getPanelTitle`/`getPanelContent`, which switch on the panel type (`markscheme`, `analysis`, `similar`, `attempt`). The content is built as HTML strings. Tags live in `userTags` and render into `#userTagsList` and `#questionTags1`. Tag text is inserted with `innerHTML` and not escaped.

## Styling

`styles.css` is split into `/* === SECTION === */` blocks that match the UI areas. The theme is dark only and comes from the `:root` custom properties (`--bg-*`, `--text-*`, `--accent`, `--correct`, `--incorrect`, `--premium`). Corners are square (`--radius: 0`). Fonts are Jost/Inter and Space Mono, loaded from Google Fonts. Use the existing variables instead of hardcoding colors.
