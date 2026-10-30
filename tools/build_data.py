"""Cipher data build: validate every question file, then regenerate data/index.json.

Run from the project folder (Python 3.10+, standard library only):
  python tools/build_data.py              validate, then write data/index.json
  python tools/build_data.py --check      validate only; also fails if data/index.json is out of date
  python tools/build_data.py --include-drafts   also list questions whose review.status is "draft"
  python tools/build_data.py --data <folder>    use another data folder (used by tests)
Exit code 0 = OK. Exit code 1 = errors; data/index.json is NOT written, nothing is silently dropped.
"""
import json
import pathlib
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
ALLOWED_TAGS = {"b", "i", "u", "sub", "sup", "br"}
ANY_TAG_RE = re.compile(r"<\s*(/?)\s*([a-zA-Z][\w-]*)([^<>]*)>")
PLACEHOLDER_RE = re.compile(r"<<.*?>>", re.S)
PAPER_ID_RE = re.compile(r"^(\d{4})_([msw])(\d{2})_(\d)(\d)$")
QFILE_RE = re.compile(r"^q(\d{2})\.json$")
FIG_SRC_RE = re.compile(r"^figures/[a-z0-9][a-z0-9_.-]*\.(png|jpg|jpeg|webp|svg)$")
PART_TYPES = {"short", "extended", "calculation", "data-interpretation", "graph", "drawing",
              "table-completion", "mcq", "other"}
STEM_TYPES = {"text", "list", "figure", "table", "answerLines"}
SERIES_CODE = {"m": "F/M", "s": "M/J", "w": "O/N"}
SESSION_ORDER = {"m": 1, "s": 2, "w": 3}


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, file, where, msg):
        if (str(file), where, msg) not in self.errors:
            self.errors.append((str(file), where, msg))

    def warn(self, file, where, msg):
        self.warnings.append((str(file), where, msg))


def rel(path, data_dir):
    try:
        return path.relative_to(data_dir.parent).as_posix()
    except ValueError:
        return str(path)


def load_json(path, rep, data_dir):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        rep.err(rel(path, data_dir), "-", f"JSON 格式错误：第 {e.lineno} 行第 {e.colno} 列：{e.msg}")
    except UnicodeDecodeError:
        rep.err(rel(path, data_dir), "-", "文件不是 UTF-8 编码，请用 UTF-8 保存")
    return None


def walk_strings(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def check_text_rules(obj, file, rep):
    """Placeholders and inline-tag whitelist on every string in a file."""
    for path, s in walk_strings(obj):
        if PLACEHOLDER_RE.search(s):
            rep.err(file, path, f"还有没填写的模板占位符：{PLACEHOLDER_RE.search(s).group(0)[:60]}")
        stack = []
        for m in ANY_TAG_RE.finditer(s):
            closing, name, rest = m.group(1), m.group(2).lower(), m.group(3).strip()
            if name not in ALLOWED_TAGS:
                rep.err(file, path, f"不允许的标签 <{name}>（只能用 b、i、u、sub、sup、br）")
                continue
            if rest and rest != "/":
                rep.err(file, path, f"标签 <{name}> 不能带属性")
            if name == "br":
                continue
            if not closing:
                stack.append(name)
            elif not stack or stack[-1] != name:
                rep.err(file, path, f"标签没有正确配对：</{name}>")
                stack = []
                break
            else:
                stack.pop()
        if stack:
            rep.err(file, path, f"标签没有关闭：<{stack[-1]}>")


def need(cond, rep, file, where, msg):
    if not cond:
        rep.err(file, where, msg)
    return bool(cond)


def is_text(v):
    return isinstance(v, str) and v.strip() != ""

def load_syllabi(data_dir, rep):
    """{syllabus_id: {"refs": {"16.2(6)": {...}}, "sections": {"16.2": {...}}, "chapters": {16: title}}}"""
    out = {}
    for f in sorted((data_dir / "syllabus").glob("*.json")):
        s = load_json(f, rep, data_dir)
        if s is None:
            continue
        refs, sections, chapters, chapter_level = {}, {}, {}, {}
        for t in s.get("topics", []):
            chapters[t["number"]] = t["title"]
            chapter_level[t["number"]] = t.get("level")
            for sec in t["sections"]:
                sections[sec["id"]] = {"title": sec["title"], "chapter": t["number"], "chapterTitle": t["title"],
                                       "level": t.get("level")}
                for o in sec["outcomes"]:
                    refs[f"{sec['id']}({o['n']})"] = {"section": sec["id"], "page": o["page"]}
        out[f.stem] = {"file": f"data/syllabus/{f.name}", "refs": refs, "sections": sections, "chapters": chapters,
                       "chapterLevel": chapter_level, "title": s.get("title", f.stem)}
    return out


def validate_paper(pdir, data_dir, syllabi, rep):
    f = rel(pdir / "paper.json", data_dir)
    if not (pdir / "paper.json").is_file():
        rep.err(rel(pdir, data_dir), "-", "试卷文件夹里缺少 paper.json（请复制 authoring/paper-template.json）")
        return None
    p = load_json(pdir / "paper.json", rep, data_dir)
    if p is None:
        return None
    check_text_rules(p, f, rep)
    m = PAPER_ID_RE.match(pdir.name)
    if not need(m, rep, f, "folder", f"文件夹名 {pdir.name} 不符合 科目代码_考季年份_component 格式，例如 9700_m26_42"):
        return None
    code, session, yy, paper_no, variant = m.groups()
    expect = {"id": pdir.name, "syllabusCode": code, "session": session, "year": 2000 + int(yy),
              "paper": paper_no, "component": paper_no + variant, "variant": variant, "subject": pdir.parent.name}
    for k, v in expect.items():
        need(p.get(k) == v, rep, f, k, f"{k} 应该是 {v!r}（由文件夹名决定），现在是 {p.get(k)!r}")
    dc = f"{code}/{paper_no}{variant}/{SERIES_CODE[session]}/{yy}"
    need(p.get("displayCode") == dc, rep, f, "displayCode", f"displayCode 应该是 {dc!r}，现在是 {p.get('displayCode')!r}")
    for k in ("subjectName", "series", "paperTitle", "level"):
        need(is_text(p.get(k)), rep, f, k, f"缺少 {k}")
    need(isinstance(p.get("totalMarks"), int) and p["totalMarks"] > 0, rep, f, "totalMarks", "totalMarks 必须是正整数")
    need(p.get("syllabus") in syllabi, rep, f, "syllabus",
         f"syllabus {p.get('syllabus')!r} 在 data/syllabus/ 里找不到对应文件")
    srcs = p.get("sources", {})
    for k in ("qp", "ms"):
        need(isinstance(srcs.get(k), dict) and is_text(srcs[k].get("file")), rep, f, f"sources.{k}", f"缺少原始材料 {k} 的文件名")
    # ER 官方没有发布时允许留空，但必须在 issues 里写明原因（missing-source, where: sources.er），
    # 不能悄悄留空；写了原因就不要求 er.file 和 examinerComments。
    er = srcs.get("er")
    er_missing_noted = isinstance(er, dict) and er.get("file") is None and any(
        isinstance(i, dict) and i.get("type") == "missing-source" and i.get("where") == "sources.er"
        for i in (p.get("issues") or []))
    if not er_missing_noted:
        need(isinstance(er, dict) and is_text(er.get("file")), rep, f, "sources.er",
             "缺少原始材料 er 的文件名；如果这份试卷官方没有发布 ER，在 issues 里加一条 "
             "{\"type\": \"missing-source\", \"where\": \"sources.er\", \"note\": \"...\"}，并把 sources.er.file 写成 null")
    for i, c in enumerate(p.get("examinerComments", [])):
        need(c.get("scope") == "paper" and c.get("target") is None, rep, f, f"examinerComments[{i}]",
             "paper.json 里只放全卷评论：scope 必须是 \"paper\"，target 必须是 null")
        check_comment_shape(c, f, f"examinerComments[{i}]", rep)
    return p


def check_comment_shape(c, f, where, rep):
    need(is_text(c.get("id")), rep, f, where + ".id", "ER 评论缺少 id")
    need(is_text(c.get("heading")), rep, f, where + ".heading", "ER 评论缺少 heading")
    pages = c.get("source", {}).get("er", {}).get("pdfPages")
    need(isinstance(pages, list) and pages and all(isinstance(x, int) for x in pages), rep, f, where + ".source.er.pdfPages",
         "ER 评论必须写 PDF 页码，例如 [16, 17]")
    blocks = c.get("blocks")
    if need(isinstance(blocks, list) and blocks, rep, f, where + ".blocks", "ER 评论至少要有一个小标题块"):
        for j, b in enumerate(blocks):
            # 有的 ER（例如 2025 年 3 月）没有 Comprehensive/Limited 小标题：这时写 "heading": null，不要自己编。
            need(b.get("heading") is None or is_text(b.get("heading")), rep, f, f"{where}.blocks[{j}].heading",
                 "小标题写 ER 原文的，例如 Comprehensive responses；ER 没有小标题就写 null")
            need(isinstance(b.get("bullets"), list) and b["bullets"] and all(is_text(x) for x in b["bullets"]),
                 rep, f, f"{where}.blocks[{j}].bullets", "bullets 必须是非空的文字列表")

def check_stem(blocks, f, where, pdir, rep, figures_used, required=True):
    if not isinstance(blocks, list) or (required and not blocks):
        rep.err(f, where, "stem 必须是至少包含一个内容块的列表")
        return
    for i, b in enumerate(blocks):
        w = f"{where}[{i}]"
        t = b.get("type") if isinstance(b, dict) else None
        if not need(t in STEM_TYPES, rep, f, w + ".type", f"内容块类型 {t!r} 不认识，可用：{', '.join(sorted(STEM_TYPES))}"):
            continue
        if t == "text":
            need(is_text(b.get("text")), rep, f, w + ".text", "text 内容块的文字不能为空")
        elif t == "list":
            need(isinstance(b.get("items"), list) and b["items"] and all(is_text(x) for x in b["items"]),
                 rep, f, w + ".items", "list 的 items 必须是非空文字列表")
        elif t == "answerLines":
            need(isinstance(b.get("labels"), list) and b["labels"] and all(is_text(x) for x in b["labels"]),
                 rep, f, w + ".labels", "answerLines 的 labels 必须是非空文字列表，例如 [\"gene\", \"protein\"]")
        elif t == "table":
            head, rows = b.get("head"), b.get("rows")
            ok = need(isinstance(head, list) and head and all(isinstance(x, str) for x in head), rep, f, w + ".head", "表格缺少 head（表头）")
            if need(isinstance(rows, list) and rows, rep, f, w + ".rows", "表格缺少 rows"):
                for r_i, r in enumerate(rows):
                    if need(isinstance(r, list), rep, f, f"{w}.rows[{r_i}]", "每一行必须是列表") and ok:
                        need(len(r) == len(head), rep, f, f"{w}.rows[{r_i}]", f"这一行有 {len(r)} 格，表头有 {len(head)} 格")
            need(is_text(b.get("caption")), rep, f, w + ".caption", "表格缺少 caption，例如 Table 3.1")
        elif t == "figure":
            src = b.get("src", "")
            for k in ("id", "caption", "alt"):
                need(is_text(b.get(k)), rep, f, f"{w}.{k}", f"图缺少 {k}（alt 是给读屏软件的文字描述）")
            if need(FIG_SRC_RE.match(src or ""), rep, f, w + ".src",
                    f"图片路径 {src!r} 格式不对：应为 figures/小写文件名.png，例如 figures/q3_fig3_1.png"):
                need((pdir / src).is_file(), rep, f, w + ".src", f"图片文件不存在：{rel(pdir / src, pdir.parent.parent)}")
                figures_used.add(src)


def ms_points(ms):
    return {pt.get("n") for pt in ms.get("points", []) if isinstance(pt, dict)}


def check_part(q, p, f, where, prefix, pdir, syl, rep, leaves, figures_used, comment_ids):
    key = p.get("key")
    need(is_text(key) and key.split(".")[:-1] == prefix and re.fullmatch(r"[a-z]{1,4}", key.split(".")[-1]),
         rep, f, where + ".key", f"key {key!r} 不对：外层写 a、b，内层写 b.i、b.ii（要带上外层字母）")
    if p.get("whole"):
        # 整道题只有一问（QP 上没有 (a)(b)）：唯一的小问写 "whole": true，不写 label。
        need(not prefix and len(q.get("parts") or []) == 1 and not p.get("parts") and "label" not in p,
             rep, f, where + ".whole", "\"whole\": true 只能用在整道题唯一的一个小问上（不能有下一级小问，也不要写 label）")
    else:
        need(is_text(p.get("label")), rep, f, where + ".label", "缺少 label，例如 (a) 或 (i)")
    if p.get("parts"):
        need("marks" not in p and "markScheme" not in p, rep, f, where,
             "有下一级小问的分组不能写 marks 或 markScheme，分值和评分方案写在最底层的小问上")
        check_stem(p.get("stem", []), f, where + ".stem", pdir, rep, figures_used, required=False)
        for i, c in enumerate(p["parts"]):
            check_part(q, c, f, f"{where}.parts[{i}]", key.split("."), pdir, syl, rep, leaves, figures_used, comment_ids)
        return
    leaves.append(p)
    marks = p.get("marks")
    need(isinstance(marks, int) and marks > 0, rep, f, where + ".marks", "最底层小问必须有正整数 marks（照 QP 方括号里的分值）")
    need(p.get("type") in PART_TYPES, rep, f, where + ".type", f"type {p.get('type')!r} 不认识，可用：{', '.join(sorted(PART_TYPES))}")
    check_stem(p.get("stem"), f, where + ".stem", pdir, rep, figures_used)
    topics = p.get("topics")
    if need(isinstance(topics, list) and topics, rep, f, where + ".topics", "至少要有一个 Topic"):
        need(sum(1 for t in topics if t.get("role") == "primary") == 1, rep, f, where + ".topics",
             "必须正好有一个 role 为 \"primary\" 的 Topic")
        for j, t in enumerate(topics):
            need(t.get("role") in ("primary", "secondary"), rep, f, f"{where}.topics[{j}].role", "role 只能是 primary 或 secondary")
            need(t.get("ref") in syl["refs"], rep, f, f"{where}.topics[{j}].ref",
                 f"考纲条目 {t.get('ref')!r} 在 2025-2027 考纲里找不到（格式例如 16.2(6)）")
    ms = p.get("markScheme")
    if need(isinstance(ms, dict), rep, f, where + ".markScheme", "缺少 markScheme"):
        need(ms.get("marks") == marks, rep, f, where + ".markScheme.marks", f"MS 分值 {ms.get('marks')!r} 和 QP 分值 {marks!r} 不一致")
        pts = ms.get("points")
        if need(isinstance(pts, list) and pts, rep, f, where + ".markScheme.points", "MS 至少要有一个评分点"):
            ns = [pt.get("n") for pt in pts]
            need(len(ns) == len(set(ns)) and all(isinstance(n, int) for n in ns), rep, f, where + ".markScheme.points",
                 "评分点的 n 必须是不重复的整数")
            for j, pt in enumerate(pts):
                need(is_text(pt.get("text")), rep, f, f"{where}.markScheme.points[{j}].text", "评分点文字不能为空")
        for k in ("guidance", "after"):
            if k in ms:
                need(isinstance(ms[k], list) and all(is_text(x) for x in ms[k]), rep, f, f"{where}.markScheme.{k}", f"{k} 必须是文字列表")
        fig = ms.get("figure")
        if fig is not None:
            # MS 本身的答案是一张图（画框图、轨道示意图、结构式），没有对应文字：ms.figure 展示这张图；
            # points 仍然要写（哪怕只是简短描述 + 分值），供 refs 引用。
            src = fig.get("src", "") if isinstance(fig, dict) else ""
            need(is_text(fig.get("alt")) if isinstance(fig, dict) else False, rep, f, where + ".markScheme.figure.alt",
                 "markScheme.figure 缺少 alt（读屏软件用的文字描述）")
            if need(FIG_SRC_RE.match(src or ""), rep, f, where + ".markScheme.figure.src",
                    f"图片路径 {src!r} 格式不对：应为 figures/小写文件名.png"):
                need((pdir / src).is_file(), rep, f, where + ".markScheme.figure.src", f"图片文件不存在：{rel(pdir / src, pdir.parent.parent)}")
                figures_used.add(src)
        src_fig = ms.get("sourceFigure")
        if src_fig is not None:
            # sourceFigure 是 MS 原页面截图，和 figure 并列保存、供核对转录是否准确；只有
            # showSourceFigure: true 时才会显示在网页上，否则截图只是存档，不算未引用。
            src = src_fig.get("src", "") if isinstance(src_fig, dict) else ""
            need(is_text(src_fig.get("alt")) if isinstance(src_fig, dict) else False, rep, f, where + ".markScheme.sourceFigure.alt",
                 "markScheme.sourceFigure 缺少 alt（读屏软件用的文字描述）")
            if need(FIG_SRC_RE.match(src or ""), rep, f, where + ".markScheme.sourceFigure.src",
                    f"图片路径 {src!r} 格式不对：应为 figures/小写文件名.png"):
                need((pdir / src).is_file(), rep, f, where + ".markScheme.sourceFigure.src", f"图片文件不存在：{rel(pdir / src, pdir.parent.parent)}")
                if ms.get("showSourceFigure"):
                    figures_used.add(src)
    ers = p.get("er")
    if need(isinstance(ers, list), rep, f, where + ".er", "er 必须是列表；没有对应 ER 评论时写 []"):
        for e in ers:
            target = comment_ids.get(e)
            if need(target is not None, rep, f, where + ".er", f"ER 评论 id {e!r} 在本文件 examinerComments 里找不到"):
                need(target == f"q{q['number']}/{key}", rep, f, where + ".er", f"ER 评论 {e} 的 target 是 {target}，不是本小问 q{q['number']}/{key}")
    ai = p.get("aiSupplement")
    if need(isinstance(ai, dict), rep, f, where + ".aiSupplement", "缺少 aiSupplement（每个小问都要有分析）"):
        need(isinstance(ai.get("explanation"), list) and ai["explanation"], rep, f, where + ".aiSupplement.explanation", "explanation 不能为空")
        need(isinstance(ai.get("reasoningChain"), list) and ai["reasoningChain"] and all(is_text(x) for x in ai["reasoningChain"]),
             rep, f, where + ".aiSupplement.reasoningChain", "reasoningChain 必须是非空的步骤列表")
        need(isinstance(ai.get("inferredMistakes"), list), rep, f, where + ".aiSupplement.inferredMistakes", "inferredMistakes 必须是列表，可以是 []")
        for j, m in enumerate(ai.get("inferredMistakes", []) or []):
            need(m.get("basis") == "inferred", rep, f, f"{where}.aiSupplement.inferredMistakes[{j}].basis",
                 "AI 推断的错误 basis 必须写 \"inferred\"；考官报告里的错误放在 ER 原文里，不放这里")
            need(not re.match(r"\s*possible (error|mistake)", str(m.get("text", "")), re.I), rep, f,
                 f"{where}.aiSupplement.inferredMistakes[{j}].text",
                 "不要以 “Possible error (inferred):” 开头：网页小标题已经是 Possible mistakes，直接写错误本身（首字母大写）")

def check_refs(entries, f, where, leaf_by_key, syl, rep):
    for j, e in enumerate(entries):
        if not isinstance(e, dict):
            rep.err(f, f"{where}[{j}]", "这里每一项必须是 {\"text\": ..., \"refs\": [...]}")
            continue
        need(is_text(e.get("text")), rep, f, f"{where}[{j}].text", "文字不能为空")
        for r in e.get("refs", []):
            kind, _, rest = str(r).partition(":")
            if kind == "ms":
                key, _, n = rest.partition("#")
                leaf = leaf_by_key.get(key)
                ok = leaf is not None and n.isdigit() and int(n) in ms_points(leaf.get("markScheme", {}))
                need(ok, rep, f, f"{where}[{j}].refs", f"引用 {r} 指向的 MS 评分点不存在（格式 ms:小问key#点号，例如 ms:c#3）")
            elif kind == "syllabus":
                need(rest in syl["refs"], rep, f, f"{where}[{j}].refs", f"引用 {r} 的考纲条目不存在")
            else:
                rep.err(f, f"{where}[{j}].refs", f"引用 {r} 格式不认识：只能是 ms:... 或 syllabus:...")


def check_home(q, leaves, syl, f, rep):
    """Where the whole question is listed: one home chapter, then either one section of it or the
    chapter's cross-topic group. Chosen by the content owner, never inferred from marks."""
    home = q.get("home")
    if not need(isinstance(home, dict), rep, f, "question.home",
                "缺少 home：写明这道题放在哪一章，例如 {\"chapter\": 16, \"section\": \"16.2\"} 或 {\"chapter\": 16, \"crossTopic\": true}"):
        return
    ch, sec, cross = home.get("chapter"), home.get("section"), home.get("crossTopic", False)
    touched = {syl["refs"][t["ref"]]["section"] for p in leaves for t in p.get("topics", []) if t.get("ref") in syl["refs"]}
    chapters = {syl["sections"][s]["chapter"] for s in touched}
    if not need(isinstance(ch, int) and ch in syl["chapters"], rep, f, "question.home.chapter", f"home.chapter {ch!r} 不是考纲里的章节号"):
        return
    level = syl.get("chapterLevel", {}).get(ch)
    need(not (isinstance(level, str) and level.lower().startswith("as")), rep, f, "question.home.chapter",
         f"home.chapter {ch} 是 AS 章节；网站列表页只显示 A Level 章节，这道题会从列表页消失")
    need(ch in chapters, rep, f, "question.home.chapter", f"home.chapter {ch} 没有出现在这道题任何小问的 topics 里")
    need(isinstance(cross, bool), rep, f, "question.home.crossTopic", "crossTopic 只能是 true 或 false")
    if cross:
        need(sec is None, rep, f, "question.home", "跨章题（crossTopic: true）不写 section")
        need(len(chapters) > 1, rep, f, "question.home.crossTopic", "这道题的 topics 只涉及一章，不是跨章题，请改写 section")
    else:
        if need(isinstance(sec, str) and sec in syl["sections"], rep, f, "question.home.section",
                f"home.section {sec!r} 不是考纲里的小节号（例如 16.2）；跨章题请写 \"crossTopic\": true"):
            need(syl["sections"][sec]["chapter"] == ch, rep, f, "question.home.section", f"小节 {sec} 不属于第 {ch} 章")
            need(sec in touched, rep, f, "question.home.section", f"小节 {sec} 没有出现在这道题任何小问的 topics 里")


def validate_question(qpath, paper, data_dir, syllabi, rep, all_ids, figures_used):
    f = rel(qpath, data_dir)
    doc = load_json(qpath, rep, data_dir)
    if doc is None:
        return None
    check_text_rules(doc, f, rep)
    q, comments = doc.get("question"), doc.get("examinerComments")
    if not need(isinstance(q, dict) and isinstance(comments, list), rep, f, "$",
                "文件最外层必须是 {\"schemaVersion\": 1, \"question\": {...}, \"examinerComments\": [...]}"):
        return None
    pdir = qpath.parent
    num = int(QFILE_RE.match(qpath.name).group(1))
    need(q.get("number") == num, rep, f, "question.number", f"文件名 {qpath.name} 对应题号 {num}，但 number 写的是 {q.get('number')!r}")
    qid = f"{pdir.name}_q{num}"
    need(q.get("id") == qid, rep, f, "question.id", f"id 应该是 {qid!r}，现在是 {q.get('id')!r}")
    need(q.get("paper") == pdir.name, rep, f, "question.paper", f"paper 应该是 {pdir.name!r}")
    if q.get("id") in all_ids:
        rep.err(f, "question.id", f"题目 id {q.get('id')} 重复，已在 {all_ids[q.get('id')]} 中使用")
    all_ids[q.get("id")] = f
    review = q.get("review", {})
    need(review.get("status") in ("draft", "approved"), rep, f, "question.review.status", "review.status 只能是 \"draft\" 或 \"approved\"")
    if review.get("status") == "approved":
        need(is_text(review.get("approvedOn")), rep, f, "question.review.approvedOn", "已批准的题要写 approvedOn 日期，例如 2026-10-24")
    syl = syllabi.get(paper.get("syllabus")) if paper else None
    if syl is None:
        return None
    comment_ids = {}
    for i, c in enumerate(comments):
        check_comment_shape(c, f, f"examinerComments[{i}]", rep)
        if c.get("id") in comment_ids:
            rep.err(f, f"examinerComments[{i}].id", f"ER 评论 id {c.get('id')} 重复")
        need(c.get("scope") in ("question", "part"), rep, f, f"examinerComments[{i}].scope",
             "题目文件里的 ER 评论 scope 只能是 \"question\" 或 \"part\"（全卷评论放 paper.json）")
        need(str(c.get("target", "")).startswith(f"q{num}"), rep, f, f"examinerComments[{i}].target",
             f"target 必须以 q{num} 开头，例如 q{num}/a")
        comment_ids[c.get("id")] = c.get("target")
    check_stem(q.get("stem", []), f, "question.stem", pdir, rep, figures_used, required=False)
    parts = q.get("parts")
    leaves = []
    if need(isinstance(parts, list) and parts, rep, f, "question.parts", "至少要有一个小问"):
        for i, p in enumerate(parts):
            check_part(q, p, f, f"question.parts[{i}]", [], pdir, syl, rep, leaves, figures_used, comment_ids)
    total = sum(p.get("marks", 0) for p in leaves if isinstance(p.get("marks"), int))
    need(q.get("marks") == total, rep, f, "question.marks",
         f"各小问分值相加是 {total}，但 question.marks 写的是 {q.get('marks')!r}（应等于 QP 上的 [Total]）")
    keys = [p.get("key") for p in leaves]
    need(len(keys) == len(set(keys)), rep, f, "question.parts", "小问 key 有重复")
    leaf_by_key = {p.get("key"): p for p in leaves}
    for p in leaves:
        ai = p.get("aiSupplement") or {}
        check_refs(ai.get("explanation", []), f, f"part {p.get('key')}.aiSupplement.explanation", leaf_by_key, syl, rep)
        check_refs(ai.get("inferredMistakes", []), f, f"part {p.get('key')}.aiSupplement.inferredMistakes", leaf_by_key, syl, rep)
    check_refs((q.get("analysis") or {}).get("shared", []), f, "question.analysis.shared", leaf_by_key, syl, rep)
    check_home(q, leaves, syl, f, rep)
    used = {e for p in leaves for e in p.get("er", [])}
    for c in comments:
        if c.get("scope") == "part" and c.get("id") not in used:
            rep.err(f, "examinerComments", f"ER 评论 {c.get('id')} 没有被任何小问的 er 列表引用")
    return {"q": q, "leaves": leaves, "syl": syl}

def plain(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def preview_of(q, leaves):
    for b in (q.get("stem") or []) + [b for p in leaves for b in p.get("stem", [])]:
        if b.get("type") == "text":
            t = plain(b["text"])
            return t if len(t) <= 220 else t[:220].rsplit(" ", 1)[0] + "…"
    return ""


def sec_key(sec):
    return tuple(int(x) for x in sec.split("."))


def index_record(paper, info, qpath, data_dir, rep):
    q, leaves, syl = info["q"], info["leaves"], info["syl"]
    secs = {}
    for p in leaves:
        for t in p["topics"]:
            sec = syl["refs"][t["ref"]]["section"]
            meta = syl["sections"][sec]
            e = secs.setdefault(sec, {"section": sec, "title": meta["title"], "chapter": meta["chapter"],
                                      "chapterTitle": meta["chapterTitle"], "role": "secondary", "parts": []})
            if t["role"] == "primary":
                e["role"] = "primary"
            if p["key"] not in e["parts"]:
                e["parts"].append(p["key"])
    topics = sorted(secs.values(), key=lambda e: (e["role"] != "primary", sec_key(e["section"])))
    cross = len({e["chapter"] for e in topics}) > 1
    if "crossTopic" in q and q["crossTopic"] != cross:
        rep.warn(rel(qpath, data_dir), "question.crossTopic",
                 f"crossTopic 写的是 {q['crossTopic']}，但按 Topic 计算是 {cross}；网站使用计算值")
    h = q["home"]
    home = {"chapter": h["chapter"], "chapterTitle": syl["chapters"][h["chapter"]], "crossTopic": bool(h.get("crossTopic"))}
    if not home["crossTopic"]:
        home.update(section=h["section"], sectionTitle=syl["sections"][h["section"]]["title"])
    subject = paper["subject"]
    return {
        "id": q["id"], "subject": subject, "subjectName": paper["subjectName"], "syllabusCode": paper["syllabusCode"],
        "paperId": paper["id"], "displayCode": paper["displayCode"], "paperNo": paper["paper"],
        "paperTitle": paper["paperTitle"], "component": paper["component"], "variant": paper["variant"],
        "year": paper["year"], "session": paper["session"], "series": paper["series"],
        "number": q["number"], "marks": q["marks"], "partCount": len(leaves), "crossTopic": cross, "home": home,
        "topics": topics, "outcomes": sorted({t["ref"] for p in leaves for t in p["topics"]}),
        "preview": preview_of(q, leaves), "status": q["review"]["status"],
        "file": f"data/{subject}/{paper['id']}/{qpath.name}", "paperFile": f"data/{subject}/{paper['id']}/paper.json",
        "syllabusFile": syl["file"],
    }


def build(data_dir, include_drafts):
    rep = Report()
    syllabi = load_syllabi(data_dir, rep)
    if not syllabi:
        rep.err("data/syllabus", "-", "没有找到考纲文件 data/syllabus/*.json")
    records, all_ids, stats = [], {}, {"papers": 0, "drafts": 0}
    for f in sorted(data_dir.iterdir()):
        if f.is_file() and f.name != "index.json":
            rep.warn(rel(f, data_dir), "-", "data/ 根目录里只应有 index.json 和各科文件夹，这个文件会被忽略")
    for sdir in sorted(d for d in data_dir.iterdir() if d.is_dir() and d.name != "syllabus"):
        for pdir in sorted(d for d in sdir.iterdir() if d.is_dir()):
            paper = validate_paper(pdir, data_dir, syllabi, rep)
            qfiles, figures_used, marks_sum = [], set(), 0
            for f in sorted(pdir.iterdir()):
                if f.is_dir():
                    if f.name != "figures":
                        rep.err(rel(f, data_dir), "-", "试卷文件夹里只能有 figures 子文件夹")
                elif f.name != "paper.json":
                    if QFILE_RE.match(f.name):
                        qfiles.append(f)
                    else:
                        rep.err(rel(f, data_dir), "-", "文件名不认识：题目文件应命名为 q01.json、q02.json …（两位数字）")
            if not qfiles:
                rep.warn(rel(pdir, data_dir), "-", "这份试卷还没有题目文件")
            if paper is None:
                continue
            stats["papers"] += 1
            marks_by_number = {}
            for qf in qfiles:
                info = validate_question(qf, paper, data_dir, syllabi, rep, all_ids, figures_used)
                if info is None:
                    continue
                if isinstance(info["q"].get("marks"), int):
                    marks_sum += info["q"]["marks"]
                    marks_by_number[info["q"].get("number")] = info["q"]["marks"]
                if info["q"].get("review", {}).get("status") != "approved" and not include_drafts:
                    stats["drafts"] += 1
                    continue
                if not rep.errors:      # index is only written when there are no errors at all
                    records.append(index_record(paper, info, qf, data_dir, rep))
            # optionalGroups: a student answers only `choose` of the listed questions, so the paper's
            # real maximum is the sum of marks minus the unchosen (lowest-marked) questions in each group.
            for group in paper.get("optionalGroups", []) if isinstance(paper, dict) else []:
                qnums, choose = group.get("questions", []), group.get("choose", 1)
                group_marks = sorted((marks_by_number[n] for n in qnums if n in marks_by_number), reverse=True)
                marks_sum -= sum(group_marks[choose:])
            if isinstance(paper.get("totalMarks"), int) and marks_sum > paper["totalMarks"]:
                rep.err(rel(pdir / "paper.json", data_dir), "totalMarks",
                        f"已录入题目的分值合计 {marks_sum}，超过了试卷总分 {paper['totalMarks']}")
            if (pdir / "figures").is_dir():
                for img in sorted((pdir / "figures").iterdir()):
                    if f"figures/{img.name}" not in figures_used:
                        rep.warn(rel(img, data_dir), "-", "这张图片没有被任何题目引用")
    records.sort(key=lambda r: (-r["year"], -SESSION_ORDER[r["session"]], r["component"], r["number"]))
    index = {
        "schemaVersion": 1,
        "note": "Generated by tools/build_data.py from the question files. Do not edit by hand.",
        "counts": {"questions": len(records), "papers": stats["papers"], "draftsNotListed": stats["drafts"]},
        "questions": records,
    }
    return rep, index, stats


def print_report(rep):
    by_file = {}
    for f, w, m in rep.errors:
        by_file.setdefault(f, []).append((w, m))
    for f, items in by_file.items():
        print(f"  {f}")
        for w, m in items:
            print(f"    [{w}] {m}")
    if rep.warnings:
        print(f"提示（不影响通过，共 {len(rep.warnings)} 条）：")
        for f, w, m in rep.warnings:
            print(f"  {f} [{w}] {m}")


def main(argv):
    check = "--check" in argv
    include_drafts = "--include-drafts" in argv
    data_dir = ROOT / "data"
    if "--data" in argv:
        data_dir = pathlib.Path(argv[argv.index("--data") + 1]).resolve()
    if not data_dir.is_dir():
        print(f"找不到数据文件夹：{data_dir}")
        return 1
    rep, index, stats = build(data_dir, include_drafts)
    print("Cipher 数据检查")
    print(f"  试卷 {stats['papers']} 份；列出题目 {index['counts']['questions']} 道；未列出的草稿 {stats['drafts']} 道")
    out = data_dir / "index.json"
    text = json.dumps(index, ensure_ascii=False, indent=1) + "\n"
    if not rep.errors and check and (not out.is_file() or out.read_text(encoding="utf-8") != text):
        rep.err("data/index.json", "-", "index.json 不是最新的：请运行 python tools/build_data.py 重新生成")
    if rep.errors:
        print(f"结果：发现 {len(rep.errors)} 个错误，data/index.json 没有更新。请按下面的位置修改后再运行：")
        print_report(rep)
        return 1
    if not check:
        out.write_text(text, encoding="utf-8")
        print("结果：通过，已写入 data/index.json")
    else:
        print("结果：通过（只检查，未写文件）")
    print_report(rep)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
