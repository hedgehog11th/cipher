// Question List: one row per whole question, filterable by topic and year.

import { loadIndex } from './data.js';
import { h } from './dom.js';

const SESSION_SHORT = { m: 'Feb/Mar', s: 'May/Jun', w: 'Oct/Nov' };

function chaptersOf(questions) {
  const chapters = new Map();
  for (const q of questions) {
    for (const t of q.topics) {
      if (!chapters.has(t.chapter)) chapters.set(t.chapter, { title: t.chapterTitle, sections: new Map() });
      chapters.get(t.chapter).sections.set(t.section, t.title);
    }
  }
  const bySecNum = (a, b) => a[0].localeCompare(b[0], 'en', { numeric: true });
  return [...chapters.entries()].sort((a, b) => a[0] - b[0])
    .map(([n, c]) => ({ n, title: c.title, sections: [...c.sections.entries()].sort(bySecNum) }));
}

function matches(q, topic, year) {
  if (year && String(q.year) !== year) return false;
  if (!topic) return true;
  return q.topics.some(t => (topic.includes('.') ? t.section === topic : String(t.chapter) === topic));
}

function topicLine(q) {
  const byChapter = new Map();
  for (const t of q.topics) {
    if (!byChapter.has(t.chapter)) byChapter.set(t.chapter, { title: t.chapterTitle, sections: [] });
    byChapter.get(t.chapter).sections.push(t.section);
  }
  return [...byChapter.entries()].map(([n, c]) =>
    h('li', null, h('span', { class: 'cx-chip-num' }, String(n)), ` ${c.title} `,
      h('span', { class: 'cx-chip-secs' }, c.sections.join(' · '))));
}

function card(q, index) {
  return h('li', { class: 'cx-row' },
    h('a', { class: 'cx-row-link', href: `#/question/${encodeURIComponent(q.id)}` },
      h('span', { class: 'cx-row-index', 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')),
      h('span', { class: 'cx-row-body' },
        h('span', { class: 'cx-row-head' },
          h('span', { class: 'cx-code' }, q.displayCode),
          h('span', { class: 'cx-row-q' }, `Question ${q.number}`)),
        h('span', { class: 'cx-row-meta' },
          `${q.year} · ${SESSION_SHORT[q.session] || q.series} · Paper ${q.paperNo} · Component ${q.component} · `,
          `${q.partCount} parts`),
        h('span', { class: 'cx-row-preview' }, q.preview),
        h('ul', { class: 'cx-chips', role: 'list', 'aria-label': 'Topics' }, topicLine(q))),
      h('span', { class: 'cx-row-marks' },
        h('span', { class: 'cx-row-marks-n' }, String(q.marks)),
        h('span', { class: 'cx-row-marks-l' }, 'marks'))));
}

export async function renderList(params) {
  const index = await loadIndex();
  const all = index.questions;
  const chapters = chaptersOf(all);
  const years = [...new Set(all.map(q => q.year))].sort((a, b) => b - a);
  const subjects = [...new Set(all.map(q => `${q.subjectName} ${q.syllabusCode}`))];
  const papers = [...new Set(all.map(q => q.paperId))];

  const state = {
    topic: chapters.some(c => String(c.n) === params.get('topic') || c.sections.some(([s]) => s === params.get('topic'))) ? params.get('topic') : '',
    year: years.map(String).includes(params.get('year')) ? params.get('year') : '',
  };

  const topicSelect = h('select', { id: 'cx-f-topic', class: 'cx-select' },
    h('option', { value: '' }, 'All topics'),
    chapters.map(c => h('optgroup', { label: `${c.n} ${c.title}` },
      h('option', { value: String(c.n) }, `${c.n} ${c.title} (whole topic)`),
      c.sections.map(([id, title]) => h('option', { value: id }, `${id} ${title}`)))));
  const yearSelect = h('select', { id: 'cx-f-year', class: 'cx-select' },
    h('option', { value: '' }, 'All years'), years.map(y => h('option', { value: String(y) }, String(y))));
  topicSelect.value = state.topic;
  yearSelect.value = state.year;

  const status = h('p', { class: 'cx-count', role: 'status', 'aria-live': 'polite' });
  const list = h('ol', { class: 'cx-rows', role: 'list' });
  const empty = h('div', { class: 'cx-empty', hidden: true },
    h('p', null, 'No questions match these filters yet.'),
    h('button', { type: 'button', class: 'cx-btn', onclick: () => { state.topic = state.year = ''; topicSelect.value = yearSelect.value = ''; update(); } },
      'Clear filters'));

  function update() {
    const shown = all.filter(q => matches(q, state.topic, state.year));
    list.replaceChildren(...shown.map(card));
    empty.hidden = shown.length > 0;
    list.hidden = shown.length === 0;
    status.textContent = shown.length === all.length
      ? `Showing all ${all.length} ${all.length === 1 ? 'question' : 'questions'}.`
      : `Showing ${shown.length} of ${all.length} ${all.length === 1 ? 'question' : 'questions'}.`;
    const qs = new URLSearchParams();
    if (state.topic) qs.set('topic', state.topic);
    if (state.year) qs.set('year', state.year);
    const hash = `#/questions${qs.toString() ? '?' + qs : ''}`;
    if (location.hash !== hash) window.history.replaceState(null, '', hash);
    sessionStorageSet('cipher.lastList', hash);
  }
  topicSelect.addEventListener('change', () => { state.topic = topicSelect.value; update(); });
  yearSelect.addEventListener('change', () => { state.year = yearSelect.value; update(); });

  const view = h('div', { class: 'cx-page cx-list' },
    h('header', { class: 'cx-page-head' },
      h('p', { class: 'cx-kicker' }, subjects.length === 1 ? `${subjects[0]} · A Level` : 'A Level'),
      h('h1', { class: 'cx-title', tabindex: '-1' }, 'Past-paper questions'),
      h('p', { class: 'cx-deck' },
        `${all.length} whole ${all.length === 1 ? 'question' : 'questions'} from ${papers.length} ${papers.length === 1 ? 'paper' : 'papers'} so far. `,
        'Each entry is one complete question with all of its parts. More questions are added as they are checked.')),
    h('form', { class: 'cx-filters', role: 'search', 'aria-label': 'Filter questions', onsubmit: e => e.preventDefault() },
      h('label', { class: 'cx-field' }, h('span', { class: 'cx-label' }, 'Topic'), topicSelect),
      h('label', { class: 'cx-field' }, h('span', { class: 'cx-label' }, 'Year'), yearSelect)),
    status, list, empty);
  update();
  return { node: view, title: 'Questions · Cipher' };
}

export function sessionStorageSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* storage unavailable: the back link falls back to the plain list */ }
}

export function lastListHash() {
  try { return sessionStorage.getItem('cipher.lastList') || '#/questions'; } catch { return '#/questions'; }
}
