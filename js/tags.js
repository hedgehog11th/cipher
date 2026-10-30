// Custom tags, kept in the browser only (localStorage), per DESIGN scope: no accounts, no server.
// One key holds a plain object { questionId: ["tag", "tag"] }. Tags are whatever the visitor
// types — there is no preset list, matching the product rule that this is free-text, not a taxonomy.

const KEY = 'cipher.tags';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage unavailable or full: tags just don't persist */ }
}

export function getTags(id) {
  const all = readAll();
  return Array.isArray(all[id]) ? all[id] : [];
}

export function addTag(id, tag) {
  const clean = tag.trim();
  if (!clean) return getTags(id);
  const all = readAll();
  const existing = Array.isArray(all[id]) ? all[id] : [];
  if (!existing.some(t => t.toLowerCase() === clean.toLowerCase())) {
    all[id] = [...existing, clean];
    writeAll(all);
  }
  return getTags(id);
}

export function removeTag(id, tag) {
  const all = readAll();
  const existing = Array.isArray(all[id]) ? all[id] : [];
  const next = existing.filter(t => t !== tag);
  if (next.length) all[id] = next; else delete all[id];
  writeAll(all);
  return next;
}

// Every question id that has at least one tag, for the library page.
export function taggedIds() {
  return Object.keys(readAll()).filter(id => readAll()[id].length);
}

// Every distinct tag in use, for the library's filter — built from what visitors actually typed,
// never from a fixed list.
export function allTags() {
  const all = readAll();
  const set = new Set();
  for (const tags of Object.values(all)) for (const t of tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}
