// Question Viewer: one whole question with every part. A part's answer (mark scheme, AI supplement,
// examiner report, topic) opens in a reading column beside the question on wide screens (laptop,
// iPad landscape) or under the part on narrow screens. The question text always stays visible.

import { loadQuestion, assetURL } from './data.js';
import { h, rich, partName as keyName, partLabel as keyLabel, pageHead, qid } from './dom.js';

// A question printed with no (a)/(b) has one part marked "whole": it is named by the question number alone.
const partName = (number, p) => p.whole ? String(number) : keyName(number, p.key);
const partLabel = (number, p) => p.whole ? String(number) : keyLabel(p.key);
import { lastListHash } from './list-view.js';
import { getTags, addTag, removeTag } from './tags.js';

const WIDE = window.matchMedia('(min-width: 1024px)');
let uid = 0;
const nextId = prefix => `${prefix}-${++uid}`;

function block(b, ctx) {
  switch (b.type) {
    case 'text': return h('p', { class: 'cx-p' }, rich(b.text));
    case 'list': return h('ul', { class: 'cx-qlist' }, b.items.map(i => h('li', null, rich(i))));
    case 'answerLines':
      // Short labels ("gene", "protein") sit right-aligned in a fixed column, as the QP prints a
      // list of single-word blanks. A long phrase ("a structure that forms a synapse with an
      // intermediate neurone…") can't fit that column, so it gets its own wider, left-aligned
      // style instead, still ending in the same dotted answer line.
      return h('div', { class: 'cx-answer-lines' },
        b.labels.map(l => h('div', { class: `cx-answer-line${l.length > 24 ? ' is-long' : ''}` }, h('span', null, rich(l)), h('span', { class: 'cx-dots', 'aria-hidden': 'true' }))));
    case 'table':
      return h('figure', { class: 'cx-table-fig' },
        h('figcaption', { class: 'cx-caption' }, rich(b.caption)),
        h('div', { class: 'cx-table-wrap', tabindex: '0', role: 'region', 'aria-label': `${b.caption} (scrolls sideways)` },
          h('table', { class: 'cx-table' },
            h('thead', null, h('tr', null, b.head.map(c => h('th', { scope: 'col' }, rich(c))))),
            h('tbody', null, b.rows.map(r => h('tr', null, r.map(c => h('td', null, rich(c)))))))));
    case 'figure': return figure(b, ctx);
    default: return null;
  }
}

function figure(b, ctx) {
  const url = assetURL(ctx.entry, b.src);
  const img = h('img', { src: url, alt: b.alt, class: 'cx-fig-img', decoding: 'async' });
  const frame = h('div', { class: 'cx-fig-frame' }, img);
  const zoom = h('button', { type: 'button', class: 'cx-textbtn', 'aria-pressed': 'false' }, 'Enlarge');
  const toggle = () => {
    const on = !frame.classList.contains('is-zoomed');
    frame.classList.toggle('is-zoomed', on);
    zoom.setAttribute('aria-pressed', String(on));
    zoom.textContent = on ? 'Fit' : 'Enlarge';
  };
  zoom.addEventListener('click', toggle);
  img.addEventListener('click', toggle);
  return h('figure', { class: 'cx-fig' }, frame,
    h('figcaption', { class: 'cx-fig-bar' },
      h('span', { class: 'cx-caption' }, rich(b.caption)),
      h('span', { class: 'cx-fig-actions' }, zoom,
        h('a', { class: 'cx-textbtn', href: url, target: '_blank', rel: 'noopener' }, 'Full size'))));
}

const stem = (blocks, ctx) => (blocks || []).map(b => block(b, ctx));

// One answer panel per part, in reading order: mark scheme, topic line, AI supplement, examiner report.
// The MS sometimes prints the answer as a table (one row per structure, one column per property)
// or as a genetic cross (parents, gametes, a Punnett square, a ratio). Transcribing that as a flat
// list of marking points reads as a wall of disconnected fragments; a real table or cross grid is
// what the printed MS actually shows. `ms.points` still carries the marking points for refs and the
// marks count, but when `ms.table` or `ms.cross` is present it — not the point list — is what's shown.
function msTable(t) {
  return h('div', { class: 'cx-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Mark scheme table' },
    h('table', { class: 'cx-table cx-ms-table' },
      t.head ? h('thead', null, h('tr', null, t.head.map(c => h('th', { scope: 'col' }, rich(c))))) : null,
      h('tbody', null, t.rows.map(r => h('tr', null, r.cells.map(c =>
        c === null ? null : h('td', typeof c === 'object' ? { rowspan: c.rowspan } : null, rich(typeof c === 'object' ? c.text : c))))))));
}

// Some MS answers are purely a drawn structure with no printed text at all (an electrons-in-boxes
// diagram, an orbital sketch, a displayed structural formula) — there is no point text to
// transcribe, only the image. `ms.figure` holds that image; `ms.points` still carries the mark
// value and a short description for refs, but the image is what the printed MS actually shows.
function msFigure(fig, ctx) {
  const url = assetURL(ctx.entry, fig.src);
  return h('figure', { class: 'cx-fig cx-ms-fig' },
    h('div', { class: 'cx-fig-frame' }, h('img', { src: url, alt: fig.alt, class: 'cx-fig-img', decoding: 'async' })),
    fig.caption ? h('figcaption', { class: 'cx-caption' }, rich(fig.caption)) : null);
}

function msCross(c) {
  return h('div', { class: 'cx-ms-cross' },
    h('p', { class: 'cx-cross-row' }, h('span', { class: 'cx-cross-label' }, 'parental phenotypes:'),
      c.parentalPhenotypes.map(x => h('span', { class: 'cx-cross-cell' }, rich(x)))),
    h('p', { class: 'cx-cross-row' }, h('span', { class: 'cx-cross-label' }, 'parental genotypes:'),
      c.parentalGenotypes.map(x => h('span', { class: 'cx-cross-cell' }, rich(x)))),
    h('div', { class: 'cx-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Punnett square' },
      h('table', { class: 'cx-table cx-cross-grid' },
        h('thead', null, h('tr', null,
          h('th', { class: 'cx-cross-corner' }, rich(c.gametesLabel || 'gametes')),
          c.colGametes.map(g => h('th', { scope: 'col' }, rich(g))))),
        h('tbody', null, c.grid.map((row, i) => h('tr', null,
          h('th', { scope: 'row' }, rich(c.rowGametes[i])),
          row.map(cell => h('td', null, rich(cell)))))))),
    h('p', { class: 'cx-cross-row' }, h('span', { class: 'cx-cross-label' }, 'ratio of offspring phenotypes:')),
    h('div', { class: 'cx-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Offspring ratio' },
      h('table', { class: 'cx-table cx-cross-ratio' },
        h('tbody', null,
          h('tr', null, c.ratioLabels.map(l => h('th', { scope: 'col' }, rich(l)))),
          h('tr', null, c.ratioValues.map(v => h('td', null, rich(v))))))));
}

function markSchemeBlock(ms, ctx) {
  const numbered = ms.points.every(pt => pt.numberedInMs !== false);
  const items = ms.points.map(pt => h('li', { class: 'cx-ms-point' },
    numbered ? h('span', { class: 'cx-ms-n' }, String(pt.n)) : null,
    h('span', { class: 'cx-ms-text' },
      rich(pt.text),
      (pt.alternatives || []).map(a => [h('span', { class: 'cx-ms-or' }, pt.alternativeJoin || 'or'), h('span', { class: 'cx-ms-alt' }, rich(a))]),
      (pt.examples || []).map(e => h('span', { class: 'cx-ms-eg' }, rich(e))))));
  // Guidance is the MS's own "Guidance" column: notes on individual marking points (ALLOW, IGNORE,
  // ECF…), not part of the answer itself. It reads after the points, as a reference list, the way
  // the printed MS prints it in a column beside the points rather than above them.
  const guidance = [...(ms.guidance || []), ...(ms.after || [])];
  return h('section', { class: 'cx-blk cx-blk-ms' },
    h('h4', { class: 'cx-blk-h' }, 'Mark scheme'),
    ms.instruction ? h('p', { class: 'cx-ms-instr' }, rich(ms.instruction)) : null,
    ms.figure ? msFigure(ms.figure, ctx) : null,
    // Some MSs print a completed table/cross and then the marking points under it ("showPoints"
    // keeps both); others print the points first and the table as reference data under the last
    // point ("tableAfterPoints" flips the order to match).
    ms.table || ms.cross ? [
      !ms.tableAfterPoints ? (ms.table ? msTable(ms.table) : msCross(ms.cross)) : null,
      ms.showPoints || ms.tableAfterPoints
        ? h(numbered ? 'ol' : 'ul', { class: `cx-ms-points${numbered ? '' : ' is-unnumbered'}`, role: 'list' }, items)
        : null,
      ms.tableAfterPoints ? (ms.table ? msTable(ms.table) : msCross(ms.cross)) : null,
    ] : h(numbered ? 'ol' : 'ul', { class: `cx-ms-points${numbered ? '' : ' is-unnumbered'}`, role: 'list' }, items),
    // sourceFigure is the original MS page image, kept alongside a transcribed table/cross/points so
    // a reader can check the transcription against the print; shown only when showSourceFigure is set
    // (some questions save the scan but transcribe it fully instead, so it stays unused on purpose).
    ms.showSourceFigure && ms.sourceFigure ? msFigure(ms.sourceFigure, ctx) : null,
    guidance.length ? h('div', { class: 'cx-ms-guidance' },
      h('h5', { class: 'cx-sub' }, 'Guidance'),
      h('ul', { class: 'cx-ms-notes', role: 'list' }, guidance.map(g => h('li', null, rich(g))))) : null);
}

function aiBlock(items, ctx, ai) {
  return h('section', { class: 'cx-blk cx-blk-ai' },
    h('h4', { class: 'cx-blk-h' }, 'AI supplement'),
    ai ? [
      h('h5', { class: 'cx-sub' }, 'Explanation'), items.map(e => h('p', { class: 'cx-ai-p' }, rich(e.text))),
      h('h5', { class: 'cx-sub' }, 'Reasoning chain'),
      h('ol', { class: 'cx-chain' }, ai.reasoningChain.map(s => h('li', null, h('span', null, rich(s))))),
      ai.inferredMistakes.length ? [h('h5', { class: 'cx-sub' }, 'Possible mistakes'),
        ai.inferredMistakes.map(m => h('p', { class: 'cx-ai-p' }, rich(m.text)))] : null,
    ] : items.map(e => h('p', { class: 'cx-ai-p' }, rich(e.text))));
}

function erBlock(comments) {
  if (!comments.length) return null;
  return h('section', { class: 'cx-blk cx-blk-er' },
    h('h4', { class: 'cx-blk-h' }, 'Examiner report'),
    comments.map(c => h('div', { class: 'cx-er-body' },
      c.blocks.map(b => [b.heading ? h('p', { class: 'cx-er-block' }, b.heading) : null, h('ul', null, b.bullets.map(x => h('li', null, rich(x))))]))));
}

function topicLine(p, ctx) {
  const t = p.topics.find(x => x.role === 'primary');
  const s = t && ctx.syllabus.refs.get(t.ref);
  if (!s) return null;
  return h('p', { class: 'cx-blk-topic' }, h('span', { class: 'cx-topic-ref' }, t.ref), ` ${s.sectionTitle}`);
}

function answerPanel(p, ctx) {
  const comments = (p.er || []).map(id => ctx.comments.get(id)).filter(Boolean);
  return h('section', { class: 'cx-answer', 'aria-label': `Answer for ${partName(ctx.question.number, p)}` },
    h('header', { class: 'cx-answer-head' },
      h('span', { class: 'cx-answer-part' }, partName(ctx.question.number, p)),
      h('span', { class: 'cx-answer-marks' }, `${p.marks} ${p.marks === 1 ? 'mark' : 'marks'}`)),
    markSchemeBlock(p.markScheme, ctx),
    topicLine(p, ctx),
    aiBlock(p.aiSupplement.explanation, ctx, p.aiSupplement),
    erBlock(comments));
}

function sharedPanel(ctx) {
  return h('section', { class: 'cx-answer', 'aria-label': 'Across all parts' },
    h('header', { class: 'cx-answer-head' }, h('span', { class: 'cx-answer-part' }, `Question ${ctx.question.number}, all parts`)),
    aiBlock(ctx.question.analysis.shared, ctx, null));
}

// The part label is the control: wide screens show the part in the reading column,
// narrow screens open or close the answer under the part.
function leafPart(p, ctx, depth) {
  const panel = answerPanel(p, ctx);
  const wrap = h('div', { class: 'cx-inline', id: nextId('cx-ans'), hidden: true }, panel);
  const label = h('button', { type: 'button', class: 'cx-part-label cx-part-btn', 'data-key': p.key, 'aria-controls': wrap.id,
    'aria-label': `${p.whole ? ctx.question.number : p.label}: show the answer for ${partName(ctx.question.number, p)}` }, p.whole ? String(ctx.question.number) : p.label);
  label.addEventListener('click', e => {
    e.stopPropagation();
    if (WIDE.matches) ctx.select(p.key);
    else {
      const open = wrap.hidden;
      wrap.hidden = !open;
      label.setAttribute('aria-expanded', String(open));
    }
  });
  ctx.labels.push({ label, wrap });
  const section = h('section', { class: `cx-part cx-leaf cx-depth-${depth}`, id: `part-${p.key.replaceAll('.', '-')}`, 'data-part': p.key },
    h('div', { class: 'cx-part-row' },
      label,
      h('div', { class: 'cx-part-body' },
        stem(p.stem, ctx),
        h('p', { class: 'cx-marks' }, h('span', { class: 'cx-visually-hidden' }, 'Marks: '), `[${p.marks}]`),
        wrap)));
  // On wide screens a click anywhere on the part (not a link, button or selection) also opens it.
  section.addEventListener('click', e => {
    if (!WIDE.matches || e.target.closest('a, button, .cx-fig') || String(window.getSelection()).length) return;
    ctx.select(p.key);
  });
  return section;
}

function part(p, ctx, depth = 0) {
  if (!p.parts || !p.parts.length) return leafPart(p, ctx, depth);
  return h('section', { class: `cx-part cx-group cx-depth-${depth}`, 'data-part': p.key },
    h('div', { class: 'cx-part-row' },
      h('span', { class: 'cx-part-label' }, p.label),
      h('div', { class: 'cx-part-body' },
        stem(p.stem, ctx),
        h('div', { class: 'cx-subparts' }, p.parts.map(c => part(c, ctx, depth + 1))))));
}

// Before a part is chosen the reading column lists the parts, so it is a way in rather than a blank.
function firstText(blocks) {
  const b = (blocks || []).find(x => x.type === 'text');
  if (!b) return '';
  const t = b.text.replace(/<[^>]+>/g, '');
  return t.length > 90 ? t.slice(0, 90).replace(/\s+\S*$/, '') + '…' : t;
}

function outline(ctx) {
  return h('section', { class: 'cx-outline', 'aria-label': 'Parts of this question' },
    h('p', { class: 'cx-outline-lead' }, 'Answers, part by part'),
    h('ol', { class: 'cx-outline-list', role: 'list' }, ctx.leaves.map(p =>
      h('li', null, h('button', { type: 'button', class: 'cx-outline-row', onclick: () => ctx.select(p.key) },
        h('span', { class: 'cx-outline-part' }, partLabel(ctx.question.number, p)),
        h('span', { class: 'cx-outline-text' }, firstText(p.stem)),
        h('span', { class: 'cx-outline-marks' }, `[${p.marks}]`))))));
}

function reader(ctx) {
  const keys = [...ctx.leaves.map(p => p.key), 'all'];
  const chips = keys.map((key, i) => h('button', { type: 'button', class: 'cx-rpart', 'data-key': key,
    onclick: () => ctx.select(key) }, key === 'all' ? 'All' : partLabel(ctx.question.number, ctx.leaves[i])));
  const body = h('div', { class: 'cx-reader-body' });
  function render() {
    const k = ctx.sel;
    chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.key === k)));
    let content;
    if (!k) content = [outline(ctx)];
    else if (k === 'all') {
      content = ctx.leaves.map(p => answerPanel(p, ctx));
      if (ctx.question.analysis && ctx.question.analysis.shared.length) content.unshift(sharedPanel(ctx));
    } else content = ctx.leaves.filter(p => p.key === k).map(p => answerPanel(p, ctx));
    body.replaceChildren(...content);
    body.scrollTop = 0;
  }
  const node = h('aside', { class: 'cx-reader', 'aria-label': 'Answers' },
    h('div', { class: 'cx-rparts', role: 'group', 'aria-label': 'Part' }, chips), body);
  return { node, render };
}

// Custom tags for this question: free-text, kept in the browser (localStorage), no preset list.
// Shown as removable chips plus a single input; typing a tag and pressing Enter adds it.
function tagsBlock(id) {
  const list = h('ul', { class: 'cx-tag-list', role: 'list' });
  const input = h('input', { type: 'text', class: 'cx-tag-input', placeholder: 'Add a tag', 'aria-label': 'Add a tag' });
  function render() {
    list.replaceChildren(...getTags(id).map(t => h('li', { class: 'cx-tag' },
      h('span', null, t),
      h('button', { type: 'button', 'aria-label': `Remove tag ${t}`, onclick: () => { removeTag(id, t); render(); } }, '×'))));
  }
  const form = h('form', { class: 'cx-tags', 'aria-label': 'Tags for this question', onsubmit: e => {
    e.preventDefault();
    addTag(id, input.value);
    input.value = '';
    render();
  } }, list, input);
  render();
  return form;
}

// The top of the page: the levels above this question, then the question's own code as the title.
function header(ctx) {
  const { entry } = ctx;
  // The remembered list hash is only useful (filters intact) if it was for this same subject;
  // otherwise (a direct link, a search/library hit, or a different subject's list last) fall
  // back to this subject's plain contents page.
  const remembered = lastListHash();
  const list = new URLSearchParams(remembered.split('?')[1] || '').get('subject') === entry.subject
    ? remembered : `#/questions?subject=${entry.subject}`;
  const join = topic => `${list}${list.includes('?') ? '&' : '?'}topic=${encodeURIComponent(topic)}`;
  const head = pageHead([
    { label: 'Home', href: '#/' },
    { label: `${entry.subjectName} ${entry.syllabusCode}`, href: `#/subject/${entry.subject}` },
    { label: `Paper ${entry.paperNo}`, href: list },
    { label: `${entry.home.chapter} ${entry.home.chapterTitle}`, href: join(entry.home.chapter) },
  ], qid(entry, ctx.question.number));
  head.querySelector('h1').id = 'cx-q-title';        // the article is labelled by this heading
  return head;
}

export async function renderQuestion(id) {
  const data = await loadQuestion(id);
  const ctx = { ...data, labels: [], sel: null };
  const q = data.question;
  const parts = q.parts.map(p => part(p, ctx));
  const rd = reader(ctx);
  const view = h('div', { class: 'cx-q-page' },
    h('div', { class: 'cx-q-main' },
      header(ctx),
      tagsBlock(id),
      h('article', { class: 'cx-sheet', 'aria-labelledby': 'cx-q-title' },
        h('div', { class: 'cx-sheet-body' },
          h('div', { class: 'cx-q-stem' }, stem(q.stem, ctx)),
          parts,
          q.parts[0].whole ? null : h('p', { class: 'cx-total' }, `[Total: ${q.marks}]`)))),
    rd.node);

  function mark() {
    const wide = WIDE.matches;
    for (const { label, wrap } of ctx.labels) {
      if (wide) { label.setAttribute('aria-pressed', String(ctx.sel === label.dataset.key)); label.removeAttribute('aria-expanded'); }
      else { label.removeAttribute('aria-pressed'); label.setAttribute('aria-expanded', String(!wrap.hidden)); }
    }
    for (const s of view.querySelectorAll('.cx-leaf')) s.classList.toggle('is-active', wide && (ctx.sel === s.dataset.part || ctx.sel === 'all'));
  }
  ctx.select = key => { ctx.sel = key; rd.render(); mark(); };

  rd.render();
  mark();
  const onChange = () => { if (!view.isConnected) WIDE.removeEventListener('change', onChange); else mark(); };
  WIDE.addEventListener('change', onChange);
  return { node: view, title: `${qid(data.entry, q.number)} · Cipher`, wide: true };
}
