// Question Viewer: one whole question with every part. Mark scheme and analysis stay closed until the
// reader opens them, and open inline under the part so the question text stays visible.

import { loadQuestion, assetURL } from './data.js';
import { h, rich, partName, pageRange } from './dom.js';
import { lastListHash } from './list-view.js';

let uid = 0;
const nextId = prefix => `${prefix}-${++uid}`;

function block(b, ctx) {
  switch (b.type) {
    case 'text': return h('p', { class: 'cx-p' }, rich(b.text));
    case 'list': return h('ul', { class: 'cx-qlist' }, b.items.map(i => h('li', null, rich(i))));
    case 'answerLines':
      return h('div', { class: 'cx-answer-lines' },
        b.labels.map(l => h('div', { class: 'cx-answer-line' }, h('span', null, rich(l)), h('span', { class: 'cx-dots', 'aria-hidden': 'true' }))));
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
  const zoom = h('button', { type: 'button', class: 'cx-btn cx-btn-small', 'aria-pressed': 'false' }, 'Enlarge');
  const toggle = () => {
    const on = !frame.classList.contains('is-zoomed');
    frame.classList.toggle('is-zoomed', on);
    zoom.setAttribute('aria-pressed', String(on));
    zoom.textContent = on ? 'Fit to page' : 'Enlarge';
  };
  zoom.addEventListener('click', toggle);
  img.addEventListener('click', toggle);
  return h('figure', { class: 'cx-fig' }, frame,
    h('figcaption', { class: 'cx-fig-bar' },
      h('span', { class: 'cx-caption' }, rich(b.caption)),
      h('span', { class: 'cx-fig-actions' }, zoom,
        h('a', { class: 'cx-btn cx-btn-small', href: url, target: '_blank', rel: 'noopener' }, 'Open full size'))));
}

function stem(blocks, ctx) {
  return (blocks || []).map(b => block(b, ctx));
}

function msRef(ref, ctx) {
  const [kind, rest] = ref.split(/:(.+)/);
  if (kind === 'syllabus') return `Syllabus ${rest}`;
  const [key, n] = rest.split('#');
  const leaf = ctx.leaves.find(p => p.key === key);
  const point = leaf && leaf.markScheme.points.find(pt => String(pt.n) === n);
  const where = point && point.numberedInMs === false ? `line ${n}` : `point ${n}`;
  return `MS ${partName(ctx.question.number, key)} ${where}`;
}

function basedOn(refs, ctx) {
  if (!refs || !refs.length) return null;
  return h('p', { class: 'cx-based' }, 'Based on: ', refs.map(r => msRef(r, ctx)).join(' · '));
}

function markSchemePanel(p, ctx) {
  const ms = p.markScheme;
  const numbered = ms.points.every(pt => pt.numberedInMs !== false);
  const items = ms.points.map(pt => h('li', { class: 'cx-ms-point' },
    numbered ? h('span', { class: 'cx-ms-n' }, String(pt.n)) : null,
    h('span', { class: 'cx-ms-text' },
      rich(pt.text),
      (pt.alternatives || []).map(a => [h('span', { class: 'cx-ms-or' }, pt.alternativeJoin || 'or'), h('span', { class: 'cx-ms-alt' }, rich(a))]),
      (pt.examples || []).map(e => h('span', { class: 'cx-ms-eg' }, rich(e))))));
  return h('section', { class: 'cx-panel cx-panel-ms', 'aria-label': `Mark scheme for ${partName(ctx.question.number, p.key)}` },
    h('header', { class: 'cx-panel-head' },
      h('span', { class: 'cx-panel-title' }, 'Mark scheme'),
      h('span', { class: 'cx-panel-meta' }, `${partName(ctx.question.number, p.key)} · ${ms.marks} ${ms.marks === 1 ? 'mark' : 'marks'}`)),
    ms.instruction ? h('p', { class: 'cx-ms-instr' }, rich(ms.instruction)) : null,
    (ms.guidance || []).map(g => h('p', { class: 'cx-ms-guide' }, rich(g))),
    h(numbered ? 'ol' : 'ul', { class: `cx-ms-points${numbered ? '' : ' is-unnumbered'}`, role: 'list' }, items),
    (ms.after || []).map(g => h('p', { class: 'cx-ms-guide' }, rich(g))),
    h('p', { class: 'cx-src' }, `Source: published mark scheme, page ${p.source.ms}. `,
      h('button', { type: 'button', class: 'cx-linkbtn', onclick: () => ctx.openKey() }, 'Mark scheme symbols')));
}

function topicItem(t, ctx) {
  const s = ctx.syllabus.refs.get(t.ref);
  if (!s) return h('li', null, t.ref);
  return h('li', { class: 'cx-topic' },
    h('span', { class: 'cx-topic-role' }, t.role === 'primary' ? 'Main' : 'Also'),
    h('span', { class: 'cx-topic-body' },
      h('span', { class: 'cx-topic-ref' }, `${t.ref} `, h('span', { class: 'cx-topic-sec' }, `${s.sectionTitle} — ${s.chapter} ${s.chapterTitle}`)),
      h('span', { class: 'cx-topic-text' }, rich(s.text)),
      s.bullets.length ? h('ul', { class: 'cx-topic-bullets' }, s.bullets.map(b => h('li', null, rich(b)))) : null,
      h('span', { class: 'cx-src' }, `Syllabus page ${s.page}`)));
}

function erQuote(c, ctx) {
  const er = c.source.er;
  return h('figure', { class: 'cx-er-quote' },
    h('p', { class: 'cx-er-heading' }, c.heading),
    h('blockquote', { class: 'cx-er-body' },
      c.blocks.map(b => [h('p', { class: 'cx-er-block' }, b.heading), h('ul', null, b.bullets.map(x => h('li', null, rich(x))))])),
    (c.corrections || []).map(k => h('p', { class: 'cx-er-correction' },
      `Corrected: “${k.from}” → “${k.to}” (${k.note}).`)),
    h('figcaption', { class: 'cx-src' },
      `Principal Examiner Report for Teachers, ${ctx.paper.series}, Paper ${ctx.paper.component}, PDF page ${pageRange(er.pdfPages)}`,
      er.printedPage == null ? ' (the report has no printed page numbers).' : `, printed page ${er.printedPage}.`));
}

function analysisPanel(p, ctx) {
  const ai = p.aiSupplement;
  const reviewed = ctx.question.review && ctx.question.review.status === 'approved';
  const comments = (p.er || []).map(id => ctx.comments.get(id)).filter(Boolean);
  return h('section', { class: 'cx-panel cx-panel-an', 'aria-label': `Analysis for ${partName(ctx.question.number, p.key)}` },
    h('header', { class: 'cx-panel-head' },
      h('span', { class: 'cx-panel-title' }, 'Analysis'),
      h('span', { class: 'cx-panel-meta' }, partName(ctx.question.number, p.key))),
    h('section', { class: 'cx-an-sec' },
      h('h4', { class: 'cx-an-h' }, 'Related syllabus topic'),
      h('ul', { class: 'cx-topics', role: 'list' }, p.topics.map(t => topicItem(t, ctx)))),
    h('section', { class: 'cx-an-sec cx-an-er' },
      h('h4', { class: 'cx-an-h' }, 'Examiner report ', h('span', { class: 'cx-tag cx-tag-er' }, 'Original text')),
      comments.length ? comments.map(c => erQuote(c, ctx))
        : h('p', { class: 'cx-muted' }, 'The examiner report has no comment on this part.')),
    h('section', { class: 'cx-an-sec cx-an-ai' },
      h('h4', { class: 'cx-an-h' }, 'AI supplement ', h('span', { class: 'cx-tag cx-tag-ai' }, 'Not from the examiners')),
      h('p', { class: 'cx-ai-note' }, reviewed
        ? 'Written with AI from the question, the mark scheme and the syllabus, and reviewed before publishing.'
        : 'Draft written with AI from the question, the mark scheme and the syllabus. Not reviewed yet.'),
      h('h5', { class: 'cx-ai-h' }, 'Explanation'),
      ai.explanation.map(e => h('div', { class: 'cx-ai-item' }, h('p', null, rich(e.text)), basedOn(e.refs, ctx))),
      h('h5', { class: 'cx-ai-h' }, 'Reasoning chain'),
      h('ol', { class: 'cx-chain' }, ai.reasoningChain.map(s => h('li', null, rich(s)))),
      h('h5', { class: 'cx-ai-h' }, 'Common mistakes (possible)'),
      ai.inferredMistakes.length
        ? ai.inferredMistakes.map(m => h('div', { class: 'cx-ai-item' }, h('p', null, rich(m.text)), basedOn(m.refs, ctx)))
        : h('p', { class: 'cx-muted' }, 'No further mistakes suggested here. Mistakes the examiners actually saw are in the examiner report above.'),
      ai.inferredMistakes.length ? h('p', { class: 'cx-ai-note' }, 'These are inferred from the question and mark scheme, not observations from the examiners.') : null));
}

function toggle(label, panel, ctx, kind) {
  const id = nextId(`cx-${kind}`);
  panel.id = id;
  panel.hidden = true;
  const btn = h('button', { type: 'button', class: `cx-toggle cx-toggle-${kind}`, 'aria-expanded': 'false', 'aria-controls': id },
    h('span', { class: 'cx-toggle-mark', 'aria-hidden': 'true' }), label);
  btn.addEventListener('click', () => ctx.setOpen(btn, btn.getAttribute('aria-expanded') !== 'true'));
  ctx.toggles[kind].push(btn);
  return btn;
}

function leafPart(p, ctx, depth) {
  const msPanel = markSchemePanel(p, ctx);
  const anPanel = analysisPanel(p, ctx);
  return h('section', { class: `cx-part cx-depth-${depth}`, id: `part-${p.key.replaceAll('.', '-')}`, 'data-part': p.key },
    h('div', { class: 'cx-part-row' },
      h('span', { class: 'cx-part-label' }, p.label),
      h('div', { class: 'cx-part-body' },
        stem(p.stem, ctx),
        h('p', { class: 'cx-marks' }, h('span', { class: 'cx-visually-hidden' }, 'Marks: '), `[${p.marks}]`),
        h('div', { class: 'cx-tools' },
          toggle('Mark scheme', msPanel, ctx, 'ms'),
          toggle('Analysis', anPanel, ctx, 'an')),
        msPanel, anPanel)));
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

function header(ctx) {
  const { entry, question, paper } = ctx;
  const groups = new Map();
  for (const t of entry.topics) {
    if (!groups.has(t.chapter)) groups.set(t.chapter, { title: t.chapterTitle, secs: [] });
    groups.get(t.chapter).secs.push(t);
  }
  return h('header', { class: 'cx-page-head cx-q-head' },
    h('nav', { class: 'cx-crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: lastListHash() }, 'Questions'), h('span', { 'aria-hidden': 'true' }, ' / '),
      h('span', null, `${entry.displayCode} Q${question.number}`)),
    h('p', { class: 'cx-kicker' }, `${paper.subjectName} ${paper.syllabusCode} · ${paper.level} · Paper ${paper.paper}: ${paper.paperTitle}`),
    h('h1', { class: 'cx-title', tabindex: '-1' },
      h('span', { class: 'cx-code' }, entry.displayCode), ' ', h('span', null, `Question ${question.number}`)),
    h('dl', { class: 'cx-meta' },
      [['Series', paper.series], ['Component', paper.component], ['Marks', String(question.marks)], ['Parts', String(ctx.leaves.length)]]
        .map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
    h('div', { class: 'cx-filed' },
      h('span', { class: 'cx-label' }, 'Topics'),
      h('ul', { class: 'cx-chips', role: 'list' }, [...groups.entries()].map(([n, g]) =>
        h('li', null, h('span', { class: 'cx-chip-num' }, String(n)), ` ${g.title} `,
          h('span', { class: 'cx-chip-secs' }, g.secs.map(t => `${t.section} ${t.title}`).join(' · ')))))));
}

export async function renderQuestion(id) {
  const data = await loadQuestion(id);
  const keyDetails = h('details', { class: 'cx-details', id: 'cx-ms-key' });
  const ctx = {
    ...data,
    toggles: { ms: [], an: [] },
    setOpen(btn, open) {
      btn.setAttribute('aria-expanded', String(open));
      document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
      syncAll();
    },
    openKey() {
      keyDetails.open = true;
      keyDetails.scrollIntoView({ block: 'start' });
      keyDetails.querySelector('summary').focus({ preventScroll: true });
    },
  };
  const q = data.question;
  const parts = q.parts.map(p => part(p, ctx));

  const allBtn = (kind, label) => {
    const b = h('button', { type: 'button', class: 'cx-btn', 'aria-pressed': 'false', 'data-all': kind }, `Show all ${label}`);
    b.addEventListener('click', () => {
      const open = b.getAttribute('aria-pressed') !== 'true';
      ctx.toggles[kind].forEach(t => ctx.setOpen(t, open));
    });
    return b;
  };
  const allMs = allBtn('ms', 'mark schemes');
  const allAn = allBtn('an', 'analysis');
  function syncAll() {
    for (const [b, kind, label] of [[allMs, 'ms', 'mark schemes'], [allAn, 'an', 'analysis']]) {
      const open = ctx.toggles[kind].every(t => t.getAttribute('aria-expanded') === 'true');
      b.setAttribute('aria-pressed', String(open));
      b.textContent = `${open ? 'Hide' : 'Show'} all ${label}`;
    }
  }

  const shared = (q.analysis && q.analysis.shared) || [];
  const sharedPanel = shared.length ? h('section', { class: 'cx-panel cx-panel-an' },
    h('section', { class: 'cx-an-sec cx-an-ai' },
      h('h4', { class: 'cx-an-h' }, 'AI supplement ', h('span', { class: 'cx-tag cx-tag-ai' }, 'Not from the examiners')),
      shared.map(e => h('div', { class: 'cx-ai-item' }, h('p', null, rich(e.text)), basedOn(e.refs, ctx))))) : null;
  const sharedToggle = sharedPanel ? toggle('Analysis across all parts', sharedPanel, ctx, 'an') : null;

  const paperComments = data.paper.examinerComments || [];
  const symbols = data.paper.msSymbols;
  if (symbols) {
    keyDetails.append(
      h('summary', null, 'Mark scheme symbols'),
      h('dl', { class: 'cx-key' }, symbols.rows.map(([sym, meaning]) => h('div', null,
        h('dt', null, sym === 'underline' ? h('u', null, 'underline') : sym), h('dd', null, meaning)))),
      h('p', { class: 'cx-src' }, `From the published mark scheme, page ${symbols.source.ms}.`));
  }

  const qpPages = q.source && q.source.qp ? pageRange(q.source.qp.pages) : '';
  const view = h('div', { class: 'cx-page cx-question' },
    header(ctx),
    h('div', { class: 'cx-q-tools' },
      h('p', { class: 'cx-hint' }, 'Try the question first. Mark schemes and analysis open under each part.'),
      h('div', { class: 'cx-q-tools-btns' }, allMs, allAn)),
    h('article', { class: 'cx-sheet', 'aria-label': `Question ${q.number}` },
      h('div', { class: 'cx-part-row cx-q-stem' },
        h('span', { class: 'cx-part-label cx-qnum' }, String(q.number)),
        h('div', { class: 'cx-part-body' }, stem(q.stem, ctx))),
      parts,
      h('p', { class: 'cx-total' }, `[Total: ${q.marks}]`)),
    sharedPanel ? h('div', { class: 'cx-after' }, h('div', { class: 'cx-tools' }, sharedToggle), sharedPanel) : null,
    h('div', { class: 'cx-after' },
      paperComments.length ? h('details', { class: 'cx-details' },
        h('summary', null, 'Examiner report: comments on the whole paper'),
        h('p', { class: 'cx-ai-note' }, 'These comments are about the whole paper. They are context only, not findings about this question.'),
        paperComments.map(c => erQuote(c, ctx))) : null,
      symbols ? keyDetails : null,
      h('footer', { class: 'cx-sources' },
        h('p', null, `Question paper ${data.paper.displayCode}, pages ${qpPages}. Mark scheme pages ${pageRange(q.source.ms.pages)}. `,
          `Examiner report PDF pages ${pageRange(q.source.er.pdfPages)}. Topics from the ${data.syllabus.title}.`),
        h('p', null, '© Cambridge University Press & Assessment. Question paper, mark scheme and examiner report text are reproduced from the published documents.'),
        q.review && q.review.status === 'approved'
          ? h('p', null, `Content reviewed ${q.review.approvedOn}.`)
          : h('p', { class: 'cx-draft' }, 'Draft: this question has not been reviewed yet.')),
      h('p', null, h('a', { class: 'cx-back', href: lastListHash() }, '← All questions'))));
  syncAll();
  return { node: view, title: `${data.entry.displayCode} Q${q.number} · Cipher` };
}
