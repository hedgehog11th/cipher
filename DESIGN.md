---
name: Cipher
concept: a marked past paper
colors:
  paper: "#e1ddd4"        # cold-press paper tile, assets/textures/paper.jpg
  mark: "rgba(120,108,88,.075)"   # the marking column, one tone step darker
  ink: "#1e1d1b"
  ink-2: "#55524c"        # secondary text
  ink-3: "#868279"        # notes, empty chapters
  blue: "#2a47cc"         # ultramarine watercolour (the marking loop only)
  blue-ink: "#23379a"     # selected / hovered label text
typography:
  type: Libre Baskerville (400, 700)              # titles, numbers, codes, marks
  serif: Libre Baskerville (400, 700, italic)    # everything that is read
  sizes: [13, 16, 20, 32]  # small, text, lead, head
spacing: [6, 12, 20, 32, 52, 84]
gutter: 72px (16px on phones)
---

# Cipher design

Tokens live in `css/cipher.css` (`:root`). This file is the why; keep the two in step.

## Concept

**A marked past paper.** The question is the printed paper: clean, set like the exam, with its own
numbers, part labels, answer lines and marks. The answers are the marking beside it, on a column one
tone darker. Nothing on the page is decoration; everything is something an exam paper or a marker has.

## Naming a question

A question is always named by its whole code, **9700/42/F/M/26/Q3**, never by its number alone: many
papers have a Question 3. The code is the question page's title and the first line of each list row.
There is no display numeral; the owner rejected the large margin number as too big and ambiguous.
This is a practice site, so the page's character comes from the paper, the typewriter face and the
one watercolour mark, not from a showpiece.

## Colour

- Paper and ink do almost everything. Secondary text is `ink-2`; notes and empty chapters `ink-3`.
- **Ultramarine appears in one place:** the loose watercolour loop (`ring.png`) around the part being
  marked, in the question and in the column's part list. Labels inside a loop turn `blue-ink`.
- No other colour, no gradients, no tinted callout boxes. The marking column is a tone step, not a colour.

## Type

- Libre Baskerville carries everything: wordmark, page and chapter titles, question and part
  numbers, paper codes, marks, and all reading text — one typeface, no monospace contrast.
- Five sizes only (see front matter). Sentence case everywhere; no tracked-out capital labels.
- Italic serif at 13px is the quiet label voice: section names, "Comprehensive responses".
- Body measure stays under ~75 characters (the question column is capped at 780px).

## Layout

- Every page shares the 72px left gutter. Pages are left-aligned; nothing is centred.
- **Page head**, the same on every page (`pageHead()` in `js/dom.js`): a breadcrumb of the levels above,
  then the page's name as the h1. Modelled on the old prototype (`Home / Biology / Paper 1 / Ch. 5 / Q22`).
  Five real levels: `#/` (Home, subjects) → `#/subject/<slug>` (the subject's papers) → `#/questions` (**Paper 4**,
  the contents page) → a filtered/search result list → `#/question/<id>` (the question). List: `Home` ›
  **Paper 4**. Question: `Home / Biology 9700 / Paper 4 / 16 Inheritance` › **9700/42/F/M/26/Q3**.
- **Home and the subject page** (`js/home-view.js`): one row per link, named by what it holds — no
  filler counts or taglines. Home lists every subject that has questions in the index, in a fixed
  order (Biology 9700, Chemistry 9701, Physics 9702, Economics 9708, Further Mathematics 9231); a
  subject with none yet simply isn't listed. The subject page lists that subject's papers, each
  linking straight to its own contents page (`#/questions?subject=<slug>&paper=<n>`). Papers 1 and 2
  of 9700, 9701, 9702 and 9708 are listed before they have questions (`AS_PAPERS` in
  `js/home-view.js`); their contents page shows the AS chapters, all grey, with no filters.
- **Question page:** page head → the sheet, one 780px column. From 1024px the marking column sits on the
  right, sticky, and shows the part outline until a part is chosen. Below 1024px the answer opens under
  its part.
- **List page** (`#/questions?subject=<slug>&paper=<n>`): one paper's questions. For an AS paper
  (1 or 2) it shows the AS half of the syllabus, otherwise the A Level half (which chapter numbers count
  as AS varies by subject: Biology and Physics 1–11, Chemistry 1–22, Economics 1–6; each subject's own
  syllabus JSON says via each topic's `level`), as a
  contents page, with no level headings. Empty chapters are one grey line each, in two columns; a chapter
  with questions spans the page with its sections and a "Cross-topic questions" group. A chapter whose
  only section has the chapter's own title (Economics, Further Mathematics) shows no section level:
  no section heading, no section filter option, and the question page's topic line names the chapter
  (`7 The price system and the microeconomy`) instead of the placeholder ref. Each whole question
  is listed once, under its `home`. The topic filter offers each chapter's cross-topic group too
  (`cross:16`). A filter switches to a plain result list.
- **Search** (`#/search?q=`, `js/search.js`, `js/search-view.js`): free text against a question's code,
  preview, chapter/section/topic names and series. A live dropdown in the masthead (up to 8 matches,
  typed) and a full results page (Enter, or "All results"), both using the same row as the contents page.
- Masthead: wordmark left (links to Home); search box and "My Library" on the right. The old
  prototype has no link anywhere now; its files are still in the repo but unreachable.
- **Tags and My Library** (`js/tags.js`, `js/library-view.js`): a personal, local-only layer — free text,
  no preset list, nothing sent anywhere. Added from a plain text input under the question's page head;
  shown as small chips there and, once a question has any, on its row in the contents page, search
  results and My Library too. `#/library` lists every tagged question with a tag filter, reusing the
  same row component as the other list pages.
- Space does the grouping: tight inside a part, generous between parts (`--sp-*`). Lines appear only
  where the paper has them: dotted answer lines, table rules, dotted lines between marking points.

## Components

- **Answer panel**, always in this order: part and marks · Mark scheme · topic line
  (`16.2(6) The roles of genes…`) · AI supplement (Explanation, Reasoning chain, Possible mistakes) ·
  Examiner report. Economics 9708 Papers 2 and 4 have no AI supplement (owner's choice), so that
  block is simply absent there, with no placeholder.
- **Matrix/determinant** (Further Mathematics): a real grid with a bracket — round for a matrix,
  a pair of bars for a determinant — never flattened into one semicolon-separated line of text.
  Works inline in a mark scheme point's running text (`markScheme.points[].segments`, mixing text
  and matrix pieces in order) or on its own line in the stem (stem block `type: "matrix"`).
- **Examiner report** is indented and slightly smaller, with no quote mark and no correction notes
  (corrections stay in the data's `review.corrections`). Its "Comprehensive / Limited responses" headings
  stay, as small grey italics, because they decide what each sentence means.
- **Figures** are multiplied into the paper (`mix-blend-mode: multiply`) so the scan's white disappears.
- Textures are rendered images (`tools/textures/*.svg` → `render.py`), never live SVG filters.

## Don't

- Coloured or thick side bars on any block; boxes or cards around questions; shadows.
- Watercolour behind titles, totals or anything that is not being marked.
- Filler text: taglines, counts, hints, "not from the examiners", "original text", meta lines.
- Tag rows, middle-dot strings, eyebrow labels, emoji, arrows appended to links.
- Courier Prime or other round typewriter faces; all-caps labels.
- Display numerals; a bare question number as a name.

## Checks before showing a round

Real viewport widths 1440, 1180, 820 and 390: no horizontal overflow, fonts and textures loaded, no
console errors, the old prototype still opens. Then look at the screenshots and fix what a stranger
would notice first.
