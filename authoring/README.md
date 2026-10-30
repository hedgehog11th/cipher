# 新增题目说明（交给 DeepSeek 和自己看）

网站只显示 `data/` 文件夹里的题目。新增一道题 = 增加一个 JSON 文件（和它的图片），然后运行一次检查命令。不用改网页代码。

## 1. 文件放在哪里

```
data/
  index.json                      ← 自动生成，不要手改
  syllabus/9700_2025-2027.json    ← 2025–2027 考纲（已提取好）
  biology/
    9700_m26_42/                  ← 一份试卷一个文件夹：科目代码_考季年份_component
      paper.json                  ← 这份试卷的基本信息（每份试卷一个）
      q03.json                    ← 一道完整大题一个文件：q01.json、q02.json …（两位数）
      figures/
        q3_fig3_1.png             ← 这道题的图片
```

- 考季字母：`m` = February/March，`s` = May/June，`w` = October/November。例如 2025 年 5/6 月 41 卷 → `9700_s25_41`。
- 图片文件名用小写英文、数字和下划线，例如 `q5_fig5_2.png`。在题目里写成 `"src": "figures/q5_fig5_2.png"`。
- 原始 PDF 不放进 `data/`，继续放在 `E:\Cipher-materials\`。

## 2. 新增一道题的步骤

1. 如果是新试卷：在 `data/biology/` 下建试卷文件夹，复制 `authoring/paper-template.json` 进去，改名为 `paper.json` 并填写。
2. 复制 `authoring/question-template.json` 到试卷文件夹，改名为 `q05.json`（按题号），交给 DeepSeek 填写。
3. 把题图放进该试卷的 `figures/` 文件夹。
4. 双击 `build-data.cmd`（或在 Cipher 文件夹运行 `python tools\build_data.py`）。
   - 显示“结果：通过” → 完成。
   - 显示错误 → 按提示的文件和位置修改，再运行一次。有错误时 `index.json` 不会被更新，题目也不会被悄悄丢掉。
5. 双击 `preview.cmd` 打开网站查看。

模板里所有 `<<...>>` 都是要替换的内容，数字 `0` 也要改成真实值。没替换完，检查会报错。

新题默认 `"review": {"status": "draft"}`，**草稿不会出现在网站上**。审核通过后改成：

```json
"review": { "status": "approved", "approvedBy": "owner", "approvedOn": "2026-10-25" }
```

只检查不写文件：`python tools\build_data.py --check`。想在网站上预览草稿：`python tools\build_data.py --include-drafts`（预览完再正常运行一次）。

## 3. 给 DeepSeek 的规则

把这一节和 `question-template.json`、`data/biology/9700_m26_42/q03.json`（已批准的样例）一起交给 DeepSeek。

1. **一道完整大题 = 一个文件 = 一条 Question。** 公共题干、全部小问、图表都在同一个文件里。不要把 (a)、(b) 拆成不同文件。
2. **网站全英文。** 题文、MS、ER 照原文；AI 补充用英文写。中文只能出现在 `<<...>>` 占位符和 `issues` 备注里。
3. **QP、MS、ER 逐字照抄**，不改写。疑似原文错误照抄，写进 `issues`。
   - 分值以 QP 方括号为准；`question.marks` 必须等于 QP 上的 `[Total: …]`。
   - MS 里的 `any two from:`、`;`、`/`、`A`、`R`、`I`、`ora`、`AW`、`max`、`or` 和替代答案都要保留。
4. **可用格式标签只有**：`<b>粗体</b>`、`<i>斜体</i>`、`<u>下划线</u>`、`<sub>下标</sub>`、`<sup>上标</sup>`、`<br>` 换行。原文的粗体、下划线（MS 下划线表示必须用这个词）、基因名斜体要照样标出。
5. **小问结构**：外层 `key` 写 `a`、`b`；有下一级时写在 `parts` 里，key 写 `b.i`、`b.ii`。分值和 MS 只写在最底层小问上。
6. **ER 原文**放在文件底部的 `examinerComments`：每个小问一条，`id` 如 `er.q5.b.ii`，`target` 如 `q5/b.ii`，保留 `Comprehensive responses` / `Limited responses` 小标题和 PDF 页码；ER 原文没有这类小标题时写 `"heading": null`，不要用 (a)(i) 之类代替。小问的 `"er"` 列出它对应的 id；ER 没有评论就写 `"er": []`。全卷总评不放这里。
7. **AI 补充**（`aiSupplement`，每个最底层小问都必须有）：
   - `explanation`：只补 ER 没讲清的原理、解题方法和必要细节，不重复 ER。
   - `reasoningChain`：学生能核对的解题步骤，一步一项。
   - `inferredMistakes`：根据题目和 MS 推断的可能错误，`basis` 必须是 `"inferred"`。直接写错误本身，首字母大写，例如 “Reversing the rule and …”；**不要**加 “Possible error (inferred):” 开头（网页小标题已经写了 Possible mistakes，检查会报错）。**不能写成考官观察到的**。
   - 每条写 `refs` 说明依据：`ms:小问key#点号`（例如 `ms:c#3`）或 `syllabus:考纲条目`（例如 `syllabus:19.1(9)`）。
8. **Topic**：`ref` 用 2025–2027 考纲的条目号，例如 `16.2(6)` = 第 16.2 节第 6 条（编号见 `data/syllabus/9700_2025-2027.json`）。每个小问正好一个 `"role": "primary"`，其余写 `"secondary"`。旧卷题目和当前考纲对不上时照常收录整道题，把映射依据写进 `issues`，不要删小问。
9. **整道题放在哪一章（`home`）**：由你决定，不按分值自动算。
   - 只涉及一章：`"home": {"chapter": 16, "section": "16.2"}`，题目列在 16.2 小节下。
   - 跨章题：`"home": {"chapter": 16, "crossTopic": true}`，题目列在第 16 章的 Cross-topic questions 下，只出现这一次。选和这道题关系最强的那一章。例如 Q3 主要考 HTT/亨廷顿病，放在第 16 章。
   - 检查会确认这一章（和小节）确实出现在这道题的 topics 里。

10. **题干里原文的项目符号（•）要拆成独立的 `list` 块**，不要和前后文字揉成一整段 `text`。每个 • 开头的句子是 `list.items` 里单独一项；如果两组 • 中间被另一句指令打断（比如先列几条背景信息，再插一句"Using the symbols, complete…"，然后还有几条 •），就拆成「text、list、text、list」这样交替的多个块，不要全塞进一个 `text`。
11. **MS 的 guidance（右边 Guidance 栏）按完整提示句转录，不按 PDF 排版折行转录。** 一句提示在 PDF 里常常跨两三行排版，必须先把这些行拼回原来的一整句，再作为 guidance 数组里的一项；**不要把每一行折行都当成单独一条**。判断一条新提示从哪里开始：通常以加粗的标记开头，例如数字+字母代号（`1F`、`2R`、`6R`）或关键词（`ALLOW`、`DO NOT ALLOW`、`IGNORE`、`ECF`、`CON`、`e.g.`）；不是这些开头的行是上一条的续行，要拼进上一条。
12. **不要为了凑一个 primary topic 而硬套不相关的考纲条目。** 有些小问本身是纯计算或纯读图（算百分比变化、算放大倍数这类），在考纲里没有独立条目。这种情况不要随便找一个数字相近或主题沾边、但实际内容不符的条目（例如把"算百分比变化"映射到"用 Spearman/Pearson 做相关分析"——这是错的，那条讲的是统计方法，不是计算本身）。应该选它所依附的那个生物概念的条目（通常就是旁边小问已经用到的那个），并在 `aiSupplement.explanation` 里说明这一步本身没有独立条目、是依附于哪个概念。拿不准就写进 `issues`，不要编一个勉强沾边的号。
13. **如果 MS 打印的表号/图号与 QP 对应的表号/图号不一致**（例如 MS 写 Table 7.1，但 QP 上对应的其实是 Table 5.1），**采用 QP 的编号**（这是学生实际看到的），在 `issues` 里记录两边不一致，不要原样照抄 MS 的错误编号。
14. **特殊符号要对照 PDF 原文核实，不要机械信任 OCR/复制出来的结果。** 基因符号通常是斜体的单个大写字母（例如 "gene <i>I</i>"），如果识别成了标点或别的字符（比如 "gene !"），这种明显不合逻辑的结果要去看原文图确认，不能直接当成原文抄进去。
15. **有外框的图（遗传图、Punnett square 之类）截图要截整个边框**，四边留一点点白边，不要只截中间内容、裁掉边框线，也不要裁得比边框还紧。
16. **一组"用•列出几件事，每件事后面一条答题线"的题（例如"写出 A–F 分别代表什么"），这几个 • 是同一个 `answerLines` block，不要拆成几个各自只有一个 label 的 block。** 正确写法：一个 block，`labels` 数组里每个 • 一项，原文的 "•" 符号保留在每个 label 开头。
    ```json
    { "type": "answerLines", "labels": [
      "•  a structure that forms a synapse with an intermediate neurone",
      "•  a structure that forms part of a neuromuscular junction",
      "•  a structure that provides insulation",
      "•  two structures that allow saltatory conduction."
    ] }
    ```
    错误写法（之前犯过的）：拆成 4 个 block，每个 `labels` 只有一项。
17. **MS 本身印成表格或遗传图（Punnett square）的，`markScheme` 要用对应结构，不能拉平成一段 `points` 文字。** 两种结构都仍然要写 `points` 数组（按原顺序编号，供 `aiSupplement.refs` 的 `ms:key#n` 引用），但视觉由 `table`/`cross` 字段接管：
    - 表格：`"markScheme": { "marks": 0, "points": [...], "table": { "head": ["列1", "列2"], "rows": [ { "n": 1, "cells": ["...", "..."] }, { "n": 2, "cells": [null, "..."] } ] } }`。`cells` 里的 `null` 表示这一格被上一行的 `{ "text": "...", "rowspan": 2 }` 合并覆盖，完整例子看 `data/biology/9700_s26_43/q09.json` 的 (a)。
    - 遗传图：`"markScheme": { "marks": 0, "points": [...], "cross": { "parentalPhenotypes": "...", "parentalGenotypes": "...", "gametesLabel": "Gametes", "colGametes": ["..."], "rowGametes": ["..."], "grid": [["...", "..."]], "ratioLabels": ["..."], "ratioValues": ["..."] } }`，完整例子看 `data/biology/9700_s26_43/q05.json` 的 (c)。
    - MS 先印一张填好的表、下面再印评分点（例如 9700_m25_42 7(c)）：两样都要显示，表格在上，加 `"showPoints": true`。
    - MS 先印编号评分点、其中一点下面附一张参考数据表（例如 9700_m24_42 4(c)：第5点"comparative data quote to support mp1–mp4"下面印着一张数据范围表）：两样都要显示，但表格排在评分点下面，加 `"tableAfterPoints": true`（不要同时加 `showPoints`）。
    - 改完表格/遗传图结构后，**检查 `points` 的编号有没有变过**（合并或重排行会改变点号），同步改掉所有引用它的 `ms:key#n`（包括同文件 `aiSupplement.refs` 里的），不要留下指向不存在点号的死引用。
18. **整道题只有一问（QP 上没有 (a)、(b)，题号后直接是题文和 [分值]，也不印 [Total]）**：`parts` 里只放一个小问，写 `"key": "a", "whole": true`，**不要写 `label`**。网页会直接用题号代替小问标签，也不显示 Total 行。MS 引用照常写 `ms:a#1`。
19. **MS 答案本身就是一张图、没有对应文字**（画完的电子排布方框图、轨道示意图、结构式等——化学/物理很常见）：加 `markScheme.figure`，字段和 stem 里的 `figure` 一样（`src`、`alt`，`caption` 可以是 `null`）。`points` 仍然要写：哪怕只是简短的文字描述 + 分值，供 `ms:key#n` 引用，不能省略。
    ```json
    "markScheme": {
      "marks": 1,
      "points": [ { "n": 1, "text": "<<简短描述这张图在说什么，供引用>>" } ],
      "figure": { "src": "figures/q1_ms_a_ii.png", "alt": "<<给读屏软件的文字描述>>", "caption": null }
    }
    ```
    完整例子看 `data/chemistry/9701_m26_42/q01.json` 的 (a)(ii)/(a)(iii)。截图规则和 stem 里的图一样：截到图本身的完整范围，不要带上整个表格单元格的空白。**不要**把 MS 答案图和 QP 题干里给学生填空用的空白图搞混——两张图通常长得很像（同一个框架，一个是空的、一个填好了），一定要去 MS 对应页面截"填好的"那张，不能偷懒直接复用 QP 的空白图。

## 4. 题干内容块（stem）可用类型

| type | 写法 |
|---|---|
| 文字 | `{"type": "text", "text": "..."}` |
| 列表 | `{"type": "list", "items": ["...", "..."]}` |
| 图 | `{"type": "figure", "id": "fig5.1", "caption": "Fig. 5.1", "src": "figures/q5_fig5_1.png", "alt": "图的英文文字描述"}` |
| 表格 | `{"type": "table", "caption": "Table 5.1", "head": ["列1", "列2"], "rows": [["...", "..."]]}` |
| 答题线 | `{"type": "answerLines", "labels": ["gene", "protein"]}` |

小问 `type` 可用：`short`、`extended`、`calculation`、`data-interpretation`、`graph`、`drawing`、`table-completion`、`mcq`、`other`。

## 5. 常见报错

| 提示 | 怎么改 |
|---|---|
| 还有没填写的模板占位符 | 把 `<<...>>` 换成真实内容 |
| 各小问分值相加是 X，但 question.marks 写的是 Y | 核对 QP 方括号和 `[Total]` |
| 考纲条目在 2025-2027 考纲里找不到 | 检查条目号，格式如 `19.2(3)` |
| 图片文件不存在 | 检查图片是否放进 `figures/`，文件名大小写是否一致 |
| JSON 格式错误：第 N 行第 M 列 | 通常是少了逗号、引号或括号 |
| 文件名不认识 | 题目文件必须叫 `q01.json` 这种格式 |
