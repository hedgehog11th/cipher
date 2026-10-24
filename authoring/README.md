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
6. **ER 原文**放在文件底部的 `examinerComments`：每个小问一条，`id` 如 `er.q5.b.ii`，`target` 如 `q5/b.ii`，保留 `Comprehensive responses` / `Limited responses` 小标题和 PDF 页码。小问的 `"er"` 列出它对应的 id；ER 没有评论就写 `"er": []`。全卷总评不放这里。
7. **AI 补充**（`aiSupplement`，每个最底层小问都必须有）：
   - `explanation`：只补 ER 没讲清的原理、解题方法和必要细节，不重复 ER。
   - `reasoningChain`：学生能核对的解题步骤，一步一项。
   - `inferredMistakes`：根据题目和 MS 推断的可能错误，`basis` 必须是 `"inferred"`，写成 “Possible error (inferred): …”。**不能写成考官观察到的**。
   - 每条写 `refs` 说明依据：`ms:小问key#点号`（例如 `ms:c#3`）或 `syllabus:考纲条目`（例如 `syllabus:19.1(9)`）。
8. **Topic**：`ref` 用 2025–2027 考纲的条目号，例如 `16.2(6)` = 第 16.2 节第 6 条（编号见 `data/syllabus/9700_2025-2027.json`）。每个小问正好一个 `"role": "primary"`，其余写 `"secondary"`。旧卷题目和当前考纲对不上时照常收录整道题，把映射依据写进 `issues`，不要删小问。

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
