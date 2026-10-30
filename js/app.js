// Entry point for the question bank: #/ (home), #/biology, #/questions, #/question/<id>, #/search,
// #/library. The old prototype's markup and script.js are kept unchanged but are no longer linked
// to; an empty hash (a fresh load with no address, or clearing the hash) redirects to "#/" rather
// than falling through to the prototype, so that page has no way in any more.

import { DataError, loadIndex } from './data.js';
import { h } from './dom.js';
import { renderList } from './list-view.js';
import { renderQuestion } from './question-view.js';
import { renderHome, renderSubject } from './home-view.js';
import { renderSearch } from './search-view.js';
import { searchQuestions } from './search.js';
import { renderLibrary } from './library-view.js';

const root = document.getElementById('v1-root');
const legacy = document.getElementById('app');
const legacyTitle = document.title;
let token = 0;
let firstRender = true;

// A live dropdown of up to 8 matches while typing; Enter (or "all results") goes to the full
// search page. The index loads once and is cached by data.js, so repeat keystrokes are free.
function searchBox() {
  const input = h('input', { type: 'search', class: 'cx-search-input', placeholder: 'Search questions', 'aria-label': 'Search questions' });
  const panel = h('div', { class: 'cx-search-panel', hidden: true });
  panel.addEventListener('mousedown', e => e.preventDefault()); // keep focus so the click still lands
  const go = q => { location.hash = `#/search?q=${encodeURIComponent(q)}`; };
  const render = async () => {
    const q = input.value.trim();
    if (q.length < 2) { panel.hidden = true; return; }
    let index;
    try { index = await loadIndex(); } catch { panel.hidden = true; return; }
    if (input.value.trim() !== q) return;          // a newer keystroke moved on
    const shown = searchQuestions(index.questions, q, 8);
    panel.replaceChildren(
      shown.length
        ? h('ol', { class: 'cx-search-results', role: 'list' },
            shown.map(r => h('li', null, h('a', { href: `#/question/${encodeURIComponent(r.id)}` },
              h('span', { class: 'cx-search-code' }, `${r.displayCode}/Q${r.number}`),
              h('span', { class: 'cx-search-preview' }, r.preview)))))
        : h('p', { class: 'cx-search-empty' }, `No questions match “${q}”.`),
      h('button', { type: 'button', class: 'cx-textbtn cx-search-all', onclick: () => go(q) }, `All results for “${q}”`));
    panel.hidden = false;
  };
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 150); });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.hidden = true; input.blur(); } });
  const form = h('form', { class: 'cx-search', role: 'search', 'aria-label': 'Search questions',
    onsubmit: e => { e.preventDefault(); clearTimeout(t); const q = input.value.trim(); if (q) go(q); } },
    input, panel);
  form.addEventListener('focusout', e => { if (!form.contains(e.relatedTarget)) panel.hidden = true; });
  return form;
}

function shell(main) {
  return [
    h('a', { class: 'cx-skip', href: '#cx-main', onclick: e => { e.preventDefault(); main.focus(); } }, 'Skip to content'),
    h('header', { class: 'cx-masthead' },
      h('a', { class: 'cx-wordmark', href: '#/', 'aria-label': 'Cipher, home' }, 'CIPHER'),
      h('nav', { class: 'cx-masthead-nav', 'aria-label': 'Main' },
        searchBox(),
        h('a', { href: '#/library' }, 'My Library'))),
    main,
  ];
}

function parseRoute() {
  const hash = location.hash;
  if (!hash.startsWith('#/')) return null;
  const [path, query = ''] = hash.slice(2).split('?');
  const params = new URLSearchParams(query);
  if (path === '') return { name: 'home', params };
  if (path === 'questions') return { name: 'list', params };
  if (path === 'search') return { name: 'search', params };
  if (path === 'library') return { name: 'library', params };
  const m = path.match(/^question\/([^/]+)$/);
  if (m) return { name: 'question', id: decodeURIComponent(m[1]) };
  const s = path.match(/^subject\/([^/]+)$/);
  if (s) return { name: 'subject', slug: decodeURIComponent(s[1]), params };
  return { name: 'missing' };
}

function errorView(err) {
  const notFound = err instanceof DataError && err.kind === 'not-found';
  return h('div', { class: 'cx-page cx-error' },
    h('p', { class: 'cx-kicker' }, notFound ? 'Not found' : 'Something went wrong'),
    h('h1', { class: 'cx-title', tabindex: '-1' }, notFound ? 'This question is not in the bank' : 'This page could not be shown'),
    h('p', { class: 'cx-deck' }, err instanceof DataError ? err.message : 'An unexpected error stopped this page from loading.'),
    h('p', null, h('a', { class: 'cx-back', href: '#/' }, '← Home')));
}

async function render() {
  if (!location.hash || location.hash === '#') {
    window.history.replaceState(null, '', '#/');
  }
  const route = parseRoute();
  const v1 = route !== null;
  document.documentElement.classList.toggle('v1', v1);
  root.hidden = !v1;
  legacy.hidden = v1;
  if (!v1) {
    document.title = legacyTitle;
    root.replaceChildren();
    return;
  }
  const mine = ++token;
  const main = h('main', { id: 'cx-main', class: 'cx-main', tabindex: '-1' }, h('p', { class: 'cx-loading' }, 'Loading…'));
  root.replaceChildren(...shell(main));
  let result;
  try {
    if (route.name === 'home') result = await renderHome();
    else if (route.name === 'subject') result = await renderSubject(route.slug);
    else if (route.name === 'list') result = await renderList(route.params);
    else if (route.name === 'search') result = await renderSearch(route.params);
    else if (route.name === 'library') result = await renderLibrary(route.params);
    else if (route.name === 'question') result = await renderQuestion(route.id);
    else result = { node: errorView(new DataError('There is no page at this address.', location.hash, 'not-found')), title: 'Not found · Cipher' };
  } catch (err) {
    if (!(err instanceof DataError)) console.error(err);
    result = { node: errorView(err), title: 'Error · Cipher' };
  }
  if (mine !== token) return;            // a newer navigation started while this one was loading
  main.classList.toggle('is-wide', !!result.wide);
  main.replaceChildren(result.node);
  document.title = result.title;
  window.scrollTo(0, 0);
  if (!firstRender) (main.querySelector('h1') || main).focus({ preventScroll: true });
  firstRender = false;
}

window.addEventListener('hashchange', render);
render();
