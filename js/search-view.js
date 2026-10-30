// Full search results page, reached from the masthead search box (Enter, or the "all results"
// link from the live dropdown). Reuses list-view's row rendering so a matched question looks the
// same here as it does on the contents page.

import { loadIndex } from './data.js';
import { h, pageHead } from './dom.js';
import { rows } from './list-view.js';
import { searchQuestions } from './search.js';

export async function renderSearch(params) {
  const q = (params.get('q') || '').trim();
  const index = await loadIndex();
  const shown = q ? searchQuestions(index.questions, q) : [];
  const body = !q
    ? h('p', { class: 'cx-empty' }, 'Type something in the search box to find a question.')
    : shown.length ? rows(shown) : h('p', { class: 'cx-empty' }, `No questions match “${q}”.`);
  const view = h('div', { class: 'cx-list' },
    pageHead([{ label: 'Home', href: '#/' }], q ? `Search: ${q}` : 'Search'),
    h('p', { class: 'cx-visually-hidden', role: 'status' }, q ? `${shown.length} result${shown.length === 1 ? '' : 's'}.` : ''),
    body);
  return { node: view, title: q ? `Search: ${q} · Cipher` : 'Search · Cipher' };
}
