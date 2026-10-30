// Free-text search across the question bank: match against the question's own code, its preview
// text, and the chapter/section/topic names it is filed under. The bank is small enough that a
// plain substring match, scored by whether it hit the code, is simple, fast and predictable —
// no separate search index to keep in step with the data.

import { qid } from './dom.js';

function haystack(q) {
  const topics = q.topics.map(t => `${t.section} ${t.title} ${t.chapterTitle}`).join(' ');
  return [qid(q, q.number), q.preview, q.home.chapterTitle, q.home.sectionTitle || '', q.series, topics]
    .join(' ')
    .toLowerCase();
}

// Every word in the query must appear somewhere in the question's haystack (AND, not OR), so a
// two-word search narrows rather than widens. Matches on the question's own code are ranked first.
export function searchQuestions(all, query, limit = Infinity) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const q of all) {
    const hay = haystack(q);
    if (words.every(w => hay.includes(w))) {
      hits.push({ q, byCode: qid(q, q.number).toLowerCase().includes(words[0]) ? 0 : 1 });
    }
  }
  hits.sort((a, b) => a.byCode - b.byCode);
  return hits.slice(0, limit).map(h => h.q);
}
