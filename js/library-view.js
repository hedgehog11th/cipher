// My Library: every question the visitor has tagged, filterable by tag. Tags live only in this
// browser (localStorage, js/tags.js); there is no account and nothing is sent anywhere.

import { loadIndex } from './data.js';
import { h, pageHead, qid } from './dom.js';
import { getTags, removeTag, taggedIds, allTags } from './tags.js';

function row(q, rerender) {
  const tags = getTags(q.id);
  return h('li', { class: 'cx-row' },
    h('a', { class: 'cx-row-link', href: `#/question/${encodeURIComponent(q.id)}` },
      h('span', { class: 'cx-row-body' },
        h('span', { class: 'cx-row-code' }, qid(q, q.number)),
        h('span', { class: 'cx-row-preview' }, q.preview))),
    h('ul', { class: 'cx-tag-list cx-tag-list-static', role: 'list' },
      tags.map(t => h('li', { class: 'cx-tag' },
        h('span', null, t),
        h('button', { type: 'button', 'aria-label': `Remove tag ${t} from this question`,
          onclick: () => { removeTag(q.id, t); rerender(); } }, '×')))));
}

export async function renderLibrary(params) {
  const index = await loadIndex();
  let state = { tag: params.get('tag') || '' };
  const view = h('div', { class: 'cx-list' });

  // Removing a tag can change both which questions are tagged and which tags exist at all (the
  // filter options), so a removal rebuilds the whole page rather than patching one row.
  function render() {
    const ids = new Set(taggedIds());
    const all = index.questions.filter(q => ids.has(q.id));
    const tags = allTags();
    if (!tags.includes(state.tag)) state.tag = '';

    const select = h('select', { class: 'cx-select', 'aria-label': 'Filter by tag' },
      h('option', { value: '' }, 'All tags'),
      tags.map(t => h('option', { value: t }, t)));
    select.value = state.tag;
    select.addEventListener('change', () => {
      state = { tag: select.value };
      const qs = new URLSearchParams();
      if (state.tag) qs.set('tag', state.tag);
      const hash = `#/library${qs.toString() ? '?' + qs : ''}`;
      window.history.replaceState(null, '', hash);
      render();
    });

    const shown = state.tag ? all.filter(q => getTags(q.id).includes(state.tag)) : all;
    const body = shown.length
      ? h('ol', { class: 'cx-rows cx-library-rows', role: 'list' }, shown.map(q => row(q, state.tag, render)))
      : h('p', { class: 'cx-empty' },
          all.length ? 'No questions have this tag any more.' : 'Tag a question from its own page to see it here.');

    view.replaceChildren(
      pageHead([{ label: 'Home', href: '#/' }], 'My Library'),
      tags.length ? h('form', { class: 'cx-filters', role: 'search', 'aria-label': 'Filter by tag', onsubmit: e => e.preventDefault() }, select) : null,
      body);
  }
  render();
  return { node: view, title: 'My Library · Cipher' };
}
