// The site's top two levels: Home lists every subject that has data (keyed by the "subject" slug
// in the index, e.g. "biology"), and a subject page lists that subject's papers. Both are plain
// index pages: a row per link, named by what it actually contains, no filler counts or taglines.

import { loadIndex } from './data.js';
import { h, pageHead } from './dom.js';

function indexRow(href, code, detail) {
  return h('li', { class: 'cx-index-row' },
    h('a', { class: 'cx-index-link', href },
      h('span', { class: 'cx-index-code' }, code),
      detail ? h('span', { class: 'cx-index-detail' }, detail) : null));
}

// A subject with no data yet (PRODUCT.md's "Later", e.g. Further Mathematics): a grey, unlinked
// row, the same way an empty chapter sits in the contents page, so the roadmap is visible without
// pretending it is open.
function disabledRow(code) {
  return h('li', { class: 'cx-index-row is-disabled' },
    h('span', { class: 'cx-index-link', 'aria-disabled': 'true' }, h('span', { class: 'cx-index-code' }, code)));
}

export async function renderHome() {
  const index = await loadIndex();
  const subjects = [...new Map(index.questions.map(q => [q.subject, { slug: q.subject, label: `${q.subjectName} ${q.syllabusCode}` }])).values()]
    .sort((a, b) => a.label.localeCompare(b.label));
  const view = h('div', { class: 'cx-list' },
    pageHead([], 'Home'),
    h('ol', { class: 'cx-index', role: 'list' },
      subjects.map(s => indexRow(`#/subject/${s.slug}`, s.label)),
      // Later subjects (PRODUCT.md) with no data folder yet, shown but not open.
      disabledRow('Further Mathematics 9231')));
  return { node: view, title: 'Cipher' };
}

export async function renderSubject(slug) {
  const index = await loadIndex();
  const qs = index.questions.filter(q => q.subject === slug);
  const papers = [...new Map(qs.map(q => [q.paperNo, { no: q.paperNo }])).values()]
    .sort((a, b) => a.no.localeCompare(b.no));
  const subject = qs.length ? `${qs[0].subjectName} ${qs[0].syllabusCode}` : slug;
  const view = h('div', { class: 'cx-list' },
    pageHead([{ label: 'Home', href: '#/' }], subject),
    h('ol', { class: 'cx-index', role: 'list' },
      // Linking straight to the unfiltered list: there is one paper's worth of questions to show
      // today, so a separate per-paper filter isn't worth building until Paper 5 exists.
      papers.map(p => indexRow(`#/questions?subject=${slug}`, `Paper ${p.no}`))));
  return { node: view, title: `${subject} · Cipher` };
}
