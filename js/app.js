// Entry point for the question bank pages (#/questions, #/question/<id>).
// Any other hash shows the original prototype pages, which are kept unchanged.

import { DataError } from './data.js';
import { h } from './dom.js';
import { renderList } from './list-view.js';
import { renderQuestion } from './question-view.js';

const root = document.getElementById('v1-root');
const legacy = document.getElementById('app');
const legacyTitle = document.title;
let token = 0;
let firstRender = true;

function shell(main) {
  return [
    h('a', { class: 'cx-skip', href: '#cx-main', onclick: e => { e.preventDefault(); main.focus(); } }, 'Skip to content'),
    h('header', { class: 'cx-masthead' },
      h('a', { class: 'cx-wordmark', href: '#/questions' }, 'CIPHER'),
      h('span', { class: 'cx-masthead-note' }, 'A Level past-paper questions'),
      h('nav', { class: 'cx-masthead-nav', 'aria-label': 'Main' },
        h('a', { href: '#/questions' }, 'Questions'),
        h('a', { href: '#', class: 'cx-legacy-link', title: 'The earlier prototype pages' }, 'Old prototype'))),
    main,
  ];
}

function parseRoute() {
  const hash = location.hash;
  if (!hash.startsWith('#/')) return null;
  const [path, query = ''] = hash.slice(2).split('?');
  const params = new URLSearchParams(query);
  if (path === 'questions' || path === '') return { name: 'list', params };
  const m = path.match(/^question\/([^/]+)$/);
  if (m) return { name: 'question', id: decodeURIComponent(m[1]) };
  return { name: 'missing' };
}

function errorView(err) {
  const notFound = err instanceof DataError && err.kind === 'not-found';
  return h('div', { class: 'cx-page cx-error' },
    h('p', { class: 'cx-kicker' }, notFound ? 'Not found' : 'Something went wrong'),
    h('h1', { class: 'cx-title', tabindex: '-1' }, notFound ? 'This question is not in the bank' : 'This page could not be shown'),
    h('p', { class: 'cx-deck' }, err instanceof DataError ? err.message : 'An unexpected error stopped this page from loading.'),
    h('p', null, h('a', { class: 'cx-back', href: '#/questions' }, '← All questions')));
}

async function render() {
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
    if (route.name === 'list') result = await renderList(route.params);
    else if (route.name === 'question') result = await renderQuestion(route.id);
    else result = { node: errorView(new DataError('There is no page at this address.', location.hash, 'not-found')), title: 'Not found · Cipher' };
  } catch (err) {
    if (!(err instanceof DataError)) console.error(err);
    result = { node: errorView(err), title: 'Error · Cipher' };
  }
  if (mine !== token) return;            // a newer navigation started while this one was loading
  main.replaceChildren(result.node);
  document.title = result.title;
  window.scrollTo(0, 0);
  if (!firstRender) (main.querySelector('h1') || main).focus({ preventScroll: true });
  firstRender = false;
}

window.addEventListener('hashchange', render);
render();
