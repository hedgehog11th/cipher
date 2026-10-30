// Question list, set as the contents of the syllabus: every A Level chapter in order, and under
// the chapters that have questions, their sections and a "Cross-topic questions" group. Each whole
// question is listed once, under the home its data names. Filtering by topic or year switches to
// a plain list.

import { loadIndex, loadChapters } from './data.js';
import { h, qid, pageHead } from './dom.js';
import { getTags } from './tags.js';

function excerpt(text, max = 150) {
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
}

// A row is named by its whole code (9700/42/F/M/26/Q3), never by the question number alone:
// many papers have a Question 3. Exported so the search results page can list matches the same way.
// Any tags the visitor has added show underneath (read-only here; manage them from the question
// page or My Library).
export function row(q) {
  const tags = getTags(q.id);
  return h('li', { class: 'cx-row' },
    h('a', { class: 'cx-row-link', href: `#/question/${encodeURIComponent(q.id)}` },
      h('span', { class: 'cx-row-body' },
        h('span', { class: 'cx-row-code' }, qid(q, q.number)),
        h('span', { class: 'cx-row-preview' }, excerpt(q.preview))),
      h('span', { class: 'cx-row-marks' }, h('span', { class: 'cx-visually-hidden' }, 'Marks: '), `[${q.marks}]`)),
    tags.length ? h('ul', { class: 'cx-tag-list cx-tag-list-static', role: 'list' },
      tags.map(t => h('li', { class: 'cx-tag' }, h('span', null, t)))) : null);
}

export const rows = qs => h('ol', { class: 'cx-rows', role: 'list' }, qs.map(row));

// Filter options mirror the contents page exactly: built from each question's home, not every
// topic it touches. A cross-topic question is only reachable through its chapter's cross-topic
// group, never through a section or another chapter it happens to touch.
function topicOptions(all) {
  const chapters = new Map();
  for (const q of all) {
    const home = chapters.get(q.home.chapter) || { title: q.home.chapterTitle, sections: new Map(), cross: false };
    if (q.home.crossTopic) home.cross = true;
    else home.sections.set(q.home.section, q.home.sectionTitle);
    chapters.set(q.home.chapter, home);
  }
  return [...chapters.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => ({
    n, title: c.title, cross: c.cross,
    sections: [...c.sections.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })),
  }));
}

function matches(q, topic, year) {
  if (year && String(q.year) !== year) return false;
  if (!topic) return true;
  // "cross:16" is the cross-topic group of chapter 16: the questions filed under it. A plain
  // chapter number matches the whole chapter (every section plus the cross-topic group), the way
  // the contents page nests them; a section number matches only a question homed in that section.
  if (topic.startsWith('cross:')) return q.home.crossTopic && String(q.home.chapter) === topic.slice(6);
  return topic.includes('.') ? q.home.section === topic : String(q.home.chapter) === topic;
}

// A chapter with questions can now run long (several sections, each with several papers' worth of
// rows), so a jump row above the list gets you straight to a chapter without scrolling every one
// above it. Only chapters that actually hold something are worth jumping to.
function jumpRow(chapters, byChapter) {
  const here = chapters.filter(c => byChapter.has(c.n));
  if (here.length < 2) return null;
  return h('nav', { class: 'cx-jump', 'aria-label': 'Jump to chapter' },
    here.map(c => h('button', {
      type: 'button', class: 'cx-jump-n',
      onclick: () => document.getElementById(`cx-ch-${c.n}`)?.scrollIntoView({ block: 'start' }),
    }, String(c.n))));
}

function contents(all, chapters) {
  const byChapter = new Map();
  for (const q of all) {
    const c = byChapter.get(q.home.chapter) || { sections: new Map(), cross: [] };
    if (q.home.crossTopic) c.cross.push(q);
    else {
      const s = c.sections.get(q.home.section) || { title: q.home.sectionTitle, qs: [] };
      s.qs.push(q);
      c.sections.set(q.home.section, s);
    }
    byChapter.set(q.home.chapter, c);
  }
  const list = h('ol', { class: 'cx-chapters', role: 'list' }, chapters.map(c => {
    const found = byChapter.get(c.n);
    if (!found) return h('li', { class: 'cx-chapter is-empty' },
      h('span', { class: 'cx-chapter-n' }, String(c.n)), h('span', { class: 'cx-chapter-t' }, c.title),
      h('span', { class: 'cx-visually-hidden' }, ', no questions yet'));
    const secs = [...found.sections.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }));
    return h('li', { class: 'cx-chapter', id: `cx-ch-${c.n}` },
      h('h3', { class: 'cx-chapter-h' }, h('span', { class: 'cx-chapter-n' }, String(c.n)), h('span', { class: 'cx-chapter-t' }, c.title)),
      secs.map(([id, s]) => h('section', { class: 'cx-toc-group' },
        h('h4', { class: 'cx-toc-group-h' }, `${id} ${s.title}`), rows(s.qs))),
      found.cross.length ? h('section', { class: 'cx-toc-group' },
        h('h4', { class: 'cx-toc-group-h' }, 'Cross-topic questions'), rows(found.cross)) : null);
  }));
  return h('div', null, jumpRow(chapters, byChapter), list);
}

export async function renderList(params) {
  const index = await loadIndex();
  const subjects = [...new Set(index.questions.map(q => q.subject))].sort();
  const subject = subjects.includes(params.get('subject')) ? params.get('subject') : subjects[0];
  const all = index.questions.filter(q => q.subject === subject);
  const paper = all[0];
  const years = [...new Set(all.map(q => q.year))].sort((a, b) => b - a);
  const options = topicOptions(all);

  // The page lists the A Level chapters: the AS chapters (1–11) are out of this release's scope.
  const syl = await loadChapters(paper.syllabusFile);
  const chapters = syl.filter(c => !/^as\b/i.test(c.level || ''));

  const valid = new Set(options.flatMap(c =>
    [String(c.n), ...c.sections.map(([s]) => s), c.cross ? `cross:${c.n}` : ''].filter(Boolean)));
  const state = {
    topic: valid.has(params.get('topic')) ? params.get('topic') : '',
    year: years.map(String).includes(params.get('year')) ? params.get('year') : '',
  };
  const topicSelect = h('select', { id: 'cx-f-topic', class: 'cx-select', 'aria-label': 'Topic' },
    h('option', { value: '' }, 'All topics'),
    options.map(c => h('optgroup', { label: `${c.n} ${c.title}` },
      h('option', { value: String(c.n) }, `${c.n} ${c.title}`),
      c.sections.map(([id, title]) => h('option', { value: id }, `${id} ${title}`)),
      c.cross ? h('option', { value: `cross:${c.n}` }, `${c.n} Cross-topic questions`) : null)));
  const yearSelect = h('select', { id: 'cx-f-year', class: 'cx-select', 'aria-label': 'Year' },
    h('option', { value: '' }, 'All years'), years.map(y => h('option', { value: String(y) }, String(y))));
  topicSelect.value = state.topic;
  yearSelect.value = state.year;

  const status = h('p', { class: 'cx-visually-hidden', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'cx-list-body' });
  const clear = () => { state.topic = state.year = ''; topicSelect.value = yearSelect.value = ''; update(); };

  function update() {
    if (!state.topic && !state.year) {
      body.replaceChildren(contents(all, chapters));
      status.textContent = `${all.length} ${all.length === 1 ? 'question' : 'questions'}, listed by chapter.`;
    } else {
      const shown = all.filter(q => matches(q, state.topic, state.year));
      const label = [state.topic ? topicSelect.selectedOptions[0].textContent : '', state.year].filter(Boolean).join(', ');
      body.replaceChildren(h('section', { class: 'cx-results' },
        h('h2', { class: 'cx-results-h' }, label),
        shown.length ? rows(shown) : h('p', { class: 'cx-empty' }, 'No questions match these filters yet.'),
        h('button', { type: 'button', class: 'cx-textbtn cx-results-clear', onclick: clear }, 'Show all chapters')));
      status.textContent = `${shown.length} of ${all.length} ${all.length === 1 ? 'question' : 'questions'}.`;
    }
    const qs = new URLSearchParams();
    qs.set('subject', subject);
    if (state.topic) qs.set('topic', state.topic);
    if (state.year) qs.set('year', state.year);
    const hash = `#/questions?${qs}`;
    if (location.hash !== hash) window.history.replaceState(null, '', hash);
    sessionStorageSet('cipher.lastList', hash);
  }
  topicSelect.addEventListener('change', () => { state.topic = topicSelect.value; update(); });
  yearSelect.addEventListener('change', () => { state.year = yearSelect.value; update(); });

  const view = h('div', { class: 'cx-list' },
    pageHead([
      { label: 'Home', href: '#/' },
      { label: `${paper.subjectName} ${paper.syllabusCode}`, href: `#/subject/${subject}` },
    ], `Paper ${paper.paperNo}`),
    h('form', { class: 'cx-filters', role: 'search', 'aria-label': 'Filter questions', onsubmit: e => e.preventDefault() },
      topicSelect, yearSelect),
    status, body);
  update();
  return { node: view, title: 'Questions · Cipher' };
}

export function sessionStorageSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* storage unavailable: the back link falls back to the plain list */ }
}

export function lastListHash() {
  try { return sessionStorage.getItem('cipher.lastList') || '#/questions'; } catch { return '#/questions'; }
}
