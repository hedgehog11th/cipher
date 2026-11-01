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

// Fixed order (DESIGN.md): Biology, Chemistry, Physics, Economics, Further Mathematics — not
// alphabetical, so Further Mathematics (a different kind of subject, not CAIE 9709 Maths) sits last.
const SUBJECT_ORDER = ['biology', 'chemistry', 'physics', 'economics', 'further-mathematics'];

// AS papers that have a contents page before any of their questions are in the bank.
export const AS_PAPERS = {
  biology: ['1', '2'], chemistry: ['1', '2'], physics: ['1', '2'], economics: ['1', '2'],
};

export const papersOf = (slug, qs) =>
  [...new Set([...(AS_PAPERS[slug] || []), ...qs.map(q => q.paperNo)])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

export async function renderHome() {
  const index = await loadIndex();
  const subjects = [...new Map(index.questions.map(q => [q.subject, { slug: q.subject, label: `${q.subjectName} ${q.syllabusCode}` }])).values()]
    .sort((a, b) => SUBJECT_ORDER.indexOf(a.slug) - SUBJECT_ORDER.indexOf(b.slug));
  const view = h('div', { class: 'cx-list' },
    pageHead([], 'Home'),
    h('ol', { class: 'cx-index', role: 'list' },
      subjects.map(s => indexRow(`#/subject/${s.slug}`, s.label))));
  return { node: view, title: 'Cipher' };
}

export async function renderSubject(slug) {
  const index = await loadIndex();
  const qs = index.questions.filter(q => q.subject === slug);
  const subject = qs.length ? `${qs[0].subjectName} ${qs[0].syllabusCode}` : slug;
  const view = h('div', { class: 'cx-list' },
    pageHead([{ label: 'Home', href: '#/' }], subject),
    h('ol', { class: 'cx-index', role: 'list' },
      papersOf(slug, qs).map(no => indexRow(`#/questions?subject=${slug}&paper=${no}`, `Paper ${no}`))));
  return { node: view, title: `${subject} · Cipher` };
}
