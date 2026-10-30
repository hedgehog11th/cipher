// Data access for the question bank. Pages call these functions and never fetch files themselves,
// so the storage behind them (static JSON files today) can change without touching the views.

const cache = new Map();

export class DataError extends Error {
  constructor(message, detail, kind = 'data') {
    super(message);
    this.name = 'DataError';
    this.detail = detail;
    this.kind = kind;
  }
}

function getJSON(path) {
  if (!cache.has(path)) {
    const pending = fetchJSON(path);
    cache.set(path, pending);
    pending.catch(() => cache.delete(path));
  }
  return cache.get(path);
}

async function fetchJSON(path) {
  let res;
  try {
    res = await fetch(path, { cache: 'no-cache' });
  } catch (err) {
    if (location.protocol === 'file:') {
      throw new DataError('The question bank has to be opened through a local web server, not as a file. Use preview.cmd in the Cipher folder.', path);
    }
    throw new DataError(`Could not load ${path}. Check that the preview server is still running.`, String(err));
  }
  if (!res.ok) throw new DataError(`Could not load ${path} (HTTP ${res.status}).`, path);
  try {
    return await res.json();
  } catch (err) {
    throw new DataError(`${path} is not valid JSON. Run tools/build_data.py to find the problem.`, String(err));
  }
}

function check(condition, message, detail) {
  if (!condition) throw new DataError(message, detail);
}

export async function loadIndex() {
  const index = await getJSON('data/index.json');
  check(index && index.schemaVersion === 1 && Array.isArray(index.questions),
    'The question index (data/index.json) has an unexpected format. Run tools/build_data.py.', 'data/index.json');
  for (const q of index.questions) {
    check(q && q.id && q.file && q.paperFile && q.syllabusFile && Array.isArray(q.topics),
      'The question index contains an incomplete entry. Run tools/build_data.py.', q && q.id);
  }
  return index;
}

// Chapter list of a syllabus file, with each chapter's sections: the contents page and the topic
// filter are both built from it. [{ n, title, level, sections: [{ id, title }] }]
export async function loadChapters(syllabusFile) {
  const s = await getJSON(syllabusFile);
  check(s && Array.isArray(s.topics), `${syllabusFile}: unexpected format.`, syllabusFile);
  return s.topics.map(t => ({
    n: t.number, title: t.title, level: t.level,
    sections: t.sections.map(sec => ({ id: sec.id, title: sec.title })),
  }));
}

function leafParts(parts, out = []) {
  for (const p of parts) {
    if (p.parts && p.parts.length) leafParts(p.parts, out);
    else out.push(p);
  }
  return out;
}

function checkQuestionDoc(doc, entry) {
  const where = entry.file;
  check(doc && doc.question && Array.isArray(doc.examinerComments), `${where}: unexpected file format.`, where);
  const q = doc.question;
  check(q.id === entry.id, `${where}: the question id does not match the index. Run tools/build_data.py.`, where);
  check(Array.isArray(q.parts) && q.parts.length, `${where}: the question has no parts.`, where);
  const ids = new Set(doc.examinerComments.map(c => c.id));
  for (const p of leafParts(q.parts)) {
    check(p.markScheme && Array.isArray(p.markScheme.points), `${where}: part ${p.key} has no mark scheme.`, where);
    check(p.aiSupplement && Array.isArray(p.aiSupplement.explanation), `${where}: part ${p.key} has no analysis.`, where);
    for (const id of p.er || []) check(ids.has(id), `${where}: part ${p.key} refers to a missing examiner comment (${id}).`, where);
  }
}

function indexSyllabus(syllabus) {
  const refs = new Map();
  for (const topic of syllabus.topics || []) {
    for (const section of topic.sections) {
      for (const o of section.outcomes) {
        refs.set(`${section.id}(${o.n})`, {
          ref: `${section.id}(${o.n})`, text: o.text, bullets: o.bullets || [], page: o.page,
          section: section.id, sectionTitle: section.title, chapter: topic.number, chapterTitle: topic.title,
        });
      }
    }
  }
  return { title: syllabus.title, refs };
}

export async function loadQuestion(id) {
  const index = await loadIndex();
  const entry = index.questions.find(q => q.id === id);
  if (!entry) throw new DataError(`Question “${id}” is not in the question bank.`, id, 'not-found');
  const [doc, paper, syllabus] = await Promise.all([getJSON(entry.file), getJSON(entry.paperFile), getJSON(entry.syllabusFile)]);
  checkQuestionDoc(doc, entry);
  return {
    entry,
    question: doc.question,
    comments: new Map(doc.examinerComments.map(c => [c.id, c])),
    paper,
    syllabus: indexSyllabus(syllabus),
    leaves: leafParts(doc.question.parts),
  };
}

// Figure paths in the data are relative to the paper folder, e.g. "figures/q3_fig3_1.png".
export function assetURL(entry, src) {
  return entry.file.replace(/[^/]+$/, '') + src;
}
