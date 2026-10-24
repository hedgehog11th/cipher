// Small DOM helpers. Text from the data files is never inserted as HTML: rich() only turns the
// whitelisted inline tags (b, i, u, sub, sup, br) into elements; anything else stays plain text.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}

const INLINE_TAG = /<(\/?)(b|i|u|sub|sup|br)\s*\/?>/gi;

export function rich(text) {
  const frag = document.createDocumentFragment();
  const stack = [frag];
  const s = String(text ?? '');
  let last = 0;
  for (const m of s.matchAll(INLINE_TAG)) {
    const top = stack[stack.length - 1];
    if (m.index > last) top.append(s.slice(last, m.index));
    last = m.index + m[0].length;
    const name = m[2].toLowerCase();
    if (name === 'br') top.append(document.createElement('br'));
    else if (!m[1]) stack.push(top.appendChild(document.createElement(name)));
    else if (stack.length > 1 && top.localName === name) stack.pop();
    // A stray closing tag is dropped; tools/build_data.py rejects these before publishing.
  }
  if (last < s.length) stack[stack.length - 1].append(s.slice(last));
  return frag;
}

export function plain(text) {
  return String(text ?? '').replace(/<[^>]*>/g, '');
}

// "3", "b.ii" -> "3(b)(ii)"
export function partName(number, key) {
  return `${number}(${key.split('.').join(')(')})`;
}

// [7, 8, 9] -> "7–9", [16] -> "16", [3, 5] -> "3, 5"
export function pageRange(pages) {
  if (!pages || !pages.length) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const consecutive = sorted.every((p, i) => i === 0 || p === sorted[i - 1] + 1);
  return consecutive && sorted.length > 1 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(', ');
}
