---
title: "Karpathy 的 LLM 知识库：用大模型编译你的个人 Wiki"
date: 2026-04-06T18:44:49+08:00
draft: false
featured_image: "https://img.riba2534.cn/images/2026/04/karpathy_llm_kb_cover.jpg"
description: "Karpathy 分享了用 LLM 构建个人知识库的完整方案：原始数据 → LLM 编译 Wiki → Obsidian 浏览。一种跳过 RAG、持续积累的知识编译范式。附完整实操指南。"
tags:
- AI
- LLM
- Karpathy
- 知识管理
- 转载
categories:
- AI
comment: true
---

> [Andrej Karpathy](https://x.com/karpathy)，OpenAI 创始成员，前特斯拉 Autopilot AI 总监，带队搞出了纯视觉自动驾驶方案，也是 Vibe Coding 概念的提出者。2022 年离开特斯拉后专注 AI 教育，他的 YouTube 课程（Neural Networks: Zero to Hero、Let's build GPT）是很多人入门深度学习的第一站。

Karpathy 4 月 2 号发了条 [X](https://x.com/karpathy/status/2039805659525644595)，标题就三个词——"LLM Knowledge Bases"。超过 1500 万次浏览、9 万次收藏。这大概是今年 AI 圈传播最广的个人分享之一了。

他聊的事我最近也在琢磨：让 LLM 帮你**管理知识**——持续维护一个你自己的知识库，一个会自动生长的个人 Wiki。ChatGPT 那种聊完就扔的对话做不到这件事，NotebookLM 那种上传文件再问答也差了一截。

三天后他又发了一条 [follow-up](https://x.com/karpathy/status/2040470801506541998)，把这个想法写成了一份详细的 [GitHub Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)（llm-wiki.md）。Gist 的内容比推文丰富得多——完整的架构设计、操作流程、工具推荐和理论思考都有。下面把推文和 Gist 的内容拆开聊，顺便加点实操的东西。

先从一个问题开始：为什么现有的"AI 知识库"方案不够好？

## RAG 的困境

目前大多数人用 LLM 处理文档的方式，Karpathy 一个词概括了——RAG（Retrieval-Augmented Generation）。你上传一堆文件，系统把它们切成小块、生成 embedding 向量存起来，查询时通过向量相似度找到相关片段，塞进 LLM 的 context window，拼出一个回答。NotebookLM 是这样，ChatGPT 的文件上传是这样，市面上大多数"知识库"产品也是这样。

这个模式能用，但仔细拆解会发现几个结构性的问题。

**第一，Chunk 边界导致语义断裂。** RAG 系统需要把文档切成小块（chunk），但切在哪里是个两难：小 chunk（100-256 tokens）检索精度高，但丢失了上下文——一个段落的因果关系可能被切成了两半；大 chunk（1024+ tokens）保留了上下文，但向量匹配变得模糊。Vectara 2025 年的研究发现，语义分块（semantic chunking）产生的片段平均只有 43 个 token，检索倒是干净了，但给 LLM 的上下文太少，答案反而不对。

Mintlify 每天处理 3 万+ 对话的文档助手也踩了同一个坑——答案一旦跨多个页面，top-K 检索直接失灵，最后他们干脆[绕过 RAG 给 agent 搭了个虚拟文件系统](https://www.mintlify.com/blog/how-we-built-a-virtual-filesystem-for-our-assistant)。

**第二，每次查询都是无状态的。** 问一个需要综合五份文档才能回答的问题，LLM 得每次都重新找到那五份文档、把碎片拼起来。arXiv 上有篇论文（2602.05152）说得很直白——"RAG methods remain fundamentally stateless: adaptations are recomputed for each query and discarded thereafter, precluding cumulative learning." 每次查询的结果都被丢弃了，没有积累。下次问类似的问题，一切从头来过。

**第三，"大海捞针"随规模恶化。** LangChain 的 Multi-Needle 测试发现，当需要同时检索多条分散在不同位置的信息时，成功率会显著下降。更麻烦的是 "Lost in the Middle" 现象——LLM 对 context 开头和结尾的信息敏感，中间部分容易被忽略。文档越多，这个问题越严重。

**第四，embedding 会过时。** 更换 embedding 模型需要重新嵌入整个语料库。文档内容变更后，对应的向量也需要更新。对于频繁变动的知识库来说，这是持续的计算开销。

这些都是 RAG 架构的结构性约束，修修补补解决不了。

## 编译，而非检索

Karpathy 走了另一条路。他让 LLM **增量地构建和维护一个持久的 Wiki**——一组结构化的、互相链接的 markdown 文件。当你添加一个新的信息来源时，LLM 会阅读整份文档，提取关键信息，然后整合进已有的 Wiki——更新实体页面、修订主题摘要、标注新数据和旧结论之间的矛盾。

用他的原话说：

> The wiki is a persistent, compounding artifact. The cross-references are already there. The contradictions have already been flagged. The synthesis already reflects everything you've read.

**Wiki 是一个持久的、不断增值的产物。** 交叉引用已经建好了，矛盾已经被标记了，综合分析已经反映了你读过的所有内容。知识被编译一次，然后持续更新。

这个"编译"的比喻很精确。如果你写过代码，可以这样理解：

| 编译器概念 | LLM Wiki 对应 |
|-----------|--------------|
| 源代码 | raw/ 目录中的原始文档 |
| 编译产物 | wiki/ 目录中的 markdown 页面 |
| 编译器 | LLM |
| 构建配置 | Schema（CLAUDE.md） |
| 增量编译 | 新文档摄入只更新受影响的 wiki 页面 |
| 依赖图 | 交叉引用和反向链接 |
| Lint / 静态分析 | Wiki 健康检查 |

在编程领域，增量编译器不会因为你改了一个文件就重新编译整个项目——它只重新编译受影响的部分。LLM Wiki 的摄入操作也是一样：一个新来源进入系统，LLM 只更新和它相关的 wiki 页面，不动其他的。

RAG 的问题用这个比喻来说就很清楚了：**RAG 相当于每次运行程序都重新编译整个项目。** 没有中间产物，没有缓存，每次都从源码开始。而 LLM Wiki 把知识"编译"成了可以直接使用的产物，后续查询直接读取编译结果。

Selman & Kautz 在 1996 年的论文中给"知识编译"下过一个形式化定义：通过预处理使知识库更显式，从而让后续的推理更高效。**用预处理时间换查询速度**——这正是 LLM Wiki 在做的事。

## 三层架构

这个系统的架构很简洁——三层。

**第一层：原始来源（Raw Sources）。** 你策划收集的原始文档——文章、论文、代码仓库、数据集、图片。这一层是不可变的，LLM 只读不写。这是你的信息源头、事实依据。Karpathy 在 Gist 中特别强调了"immutable"——原始来源是真相的锚点，wiki 中的所有衍生内容都应该能追溯到这里。

**第二层：Wiki。** LLM 生成和维护的 markdown 文件目录——摘要、实体页面、概念页面、对比分析、综述。LLM 完全拥有这一层。你读它，LLM 写它。

**第三层：Schema。** 一份告诉 LLM wiki 结构、约定和工作流的配置文件。Claude Code 用 CLAUDE.md，Codex 用 AGENTS.md。这是整套系统的关键配置——它决定了 LLM 是一个有章法的 wiki 维护者，还是一个漫无目的的聊天机器人。

具体的目录结构长这样：

```
wiki-root/
├── CLAUDE.md              # Schema：定义 wiki 结构和工作流
├── raw/                   # 第一层：不可变的原始资料
│   ├── articles/          # 网页文章（通过 Obsidian Web Clipper 抓取）
│   ├── papers/            # 学术论文
│   ├── transcripts/       # 播客/视频文字稿
│   └── data/              # 数据集、CSV、JSON
├── wiki/                  # 第二层：LLM 维护的 Wiki
│   ├── index.md           # 总索引——每个页面一行摘要
│   ├── log.md             # 操作日志（纯追加）
│   ├── entities/          # 实体页面（人物、公司、工具）
│   ├── concepts/          # 概念页面（理论、框架、方法论）
│   ├── sources/           # 来源摘要（每个摄入的来源一个）
│   ├── comparisons/       # 对比分析
│   └── maps/              # 主题导航页（概念集群的入口）
└── assets/                # 图片、图表
```

### Wiki 页面的 Frontmatter 设计

每种页面类型有对应的 YAML frontmatter 结构。这不是可选项——frontmatter 让 Obsidian 的 Dataview 插件能做动态查询，也让 LLM 在 lint 时能程序化地检查一致性。

一个概念页面的 frontmatter 长这样：

```yaml
---
type: concept
title: "LLM Knowledge Bases"
aliases: [llm-wiki, llm-kb]
created: 2026-04-02
updated: 2026-04-06
source_count: 5
sources:
  - raw/articles/karpathy-llm-kb-tweet.md
  - raw/articles/karpathy-idea-file-gist.md
related:
  - concepts/rag.md
  - concepts/memex.md
  - entities/karpathy.md
tags: [knowledge-management, ai-workflow]
status: active
confidence: high
---
```

`confidence` 字段是个好设计——一个综合了 5 个交叉验证来源的页面，和一个只基于单篇博客的页面，可信度完全不同。这让 LLM 在查询时能合理地给信息加权，也让人类知道哪些地方值得投入验证精力。

`status` 字段（active / stub / needs-update / deprecated）则服务于 lint 流程。stub 意味着"占位符，等更多来源"；needs-update 意味着"有更新的信息还没被整合"。

### Schema（CLAUDE.md）的核心内容

Schema 文件是这套系统中最关键的一块——你和 LLM 共同演化的"操作手册"，定义了 wiki 的结构约定、工作流步骤和写作规范。

一个 Schema 里需要包含：目录结构约定（每种页面类型放哪）、frontmatter 规范（必填字段、枚举值）、不可变性规则（raw/ 只读）、三个核心工作流（ingest / query / lint）的具体步骤，以及写作风格约定（引用格式、wikilink 规范等）。

Karpathy 在 Gist 中的说法是："This is the key configuration file — it's what makes the LLM a disciplined wiki maintainer rather than a generic chatbot." 关键配置，让 LLM 成为一个有纪律的 wiki 维护者。你和 LLM 会随着时间共同演化这个文件。

Schema 不需要一开始就写得很完善。从 5-10 个来源开始，用最简单的结构，在使用过程中不断迭代。每做 10-20 次摄入后回顾一下 Schema，把发现的模式编码进去——"概念页面都应该有一个 key claims 小节"、"对比分析必须有表格"之类的。

## 四个核心操作

### 摄入（Ingest）

往 raw 目录里放一份新文档，告诉 LLM 处理它。Gist 里描述的完整流程：

1. LLM 阅读完整的原始文档
2. 和你讨论关键要点（2-3 条摘要 + 值得关注的论断）
3. 等你确认后，在 wiki/sources/ 创建来源摘要页面
4. 更新或创建相关的实体页面（wiki/entities/）
5. 更新或创建相关的概念页面（wiki/concepts/）
6. 检查新来源和已有 wiki 内容之间的矛盾，用标注标记
7. 更新所有受影响页面的交叉引用
8. 更新 wiki/index.md
9. 追加到 wiki/log.md
10. 向你报告：创建了什么、更新了什么、有没有矛盾

**一个信息来源可能触发 10-15 个 wiki 页面的更新。** Karpathy 说他偏好逐个摄入，全程参与。你也可以批量摄入，但他建议在早期保持参与度——读摘要、检查更新、引导 LLM 侧重什么。

如果用 Claude Code 作为 LLM agent，一次摄入的 session 大概是这样的：

```
你：ingest raw/articles/karpathy-llm-kb-tweet.md

Claude Code:
  → Read("raw/articles/karpathy-llm-kb-tweet.md")
  → "这篇文章有三个核心论点：1) ... 2) ... 3) ... 要继续吗？"

你：继续，重点关注和 RAG 的对比

Claude Code:
  → Write("wiki/sources/karpathy-llm-kb.md", ...)     # 创建来源摘要
  → Read("wiki/entities/karpathy.md")                   # 检查实体页面
  → Edit("wiki/entities/karpathy.md", ...)              # 更新实体页面
  → Write("wiki/concepts/llm-knowledge-bases.md", ...)  # 创建概念页面
  → Read("wiki/concepts/rag.md")                        # 检查是否有矛盾
  → Edit("wiki/concepts/rag.md", ...)                   # 添加对比引用
  → Edit("wiki/index.md", ...)                          # 更新索引
  → Edit("wiki/log.md", ...)                            # 追加日志
  → "完成。创建了 2 个页面，更新了 2 个页面。RAG 概念页面新增了
     和 LLM Wiki 的对比章节，没有发现矛盾。"
```

Claude Code 的 Edit 工具在这里很关键——它用精确字符串匹配做替换，可以在一个 500 行的 wiki 页面里只改一段话，不碰其他内容。这比全文重写安全得多，特别是一个来源需要触发十几个页面更新的时候。

### 索引系统

两个特殊文件帮助导航不断增长的 wiki。

**index.md** 是内容导向的总目录：

```markdown
# Wiki Index

Last updated: 2026-04-06 | Pages: 47 | Sources: 23

## Entities (18)
- [[entities/karpathy]] — AI 研究者，前 OpenAI/Tesla (3 sources)
- [[entities/obsidian]] — 基于 Markdown 的知识管理应用 (2 sources)
...

## Concepts (15)
- [[concepts/llm-knowledge-bases]] — 用 LLM 构建持久 Wiki (5 sources)
- [[concepts/rag]] — 检索增强生成 (4 sources)
...

## Source Summaries (23)
- [[sources/karpathy-llm-kb]] — LLM Wiki 架构推文 (2026-04-02)
...
```

LLM 在回答查询时先读索引找到相关页面，再钻入细节。Karpathy 说在中等规模下——大约 100 个来源、几百个页面——这种方式出乎意料地好用，不需要 embedding 搜索基础设施。

**log.md** 是按时间顺序的操作记录，纯追加：

```markdown
## [2026-04-02] ingest | Karpathy: LLM Knowledge Bases
- Source: raw/articles/karpathy-llm-kb-tweet.md
- Pages created: sources/karpathy-llm-kb.md, concepts/llm-knowledge-bases.md
- Pages updated: entities/karpathy.md, concepts/rag.md
- Contradictions: none

## [2026-04-06] query | RAG 和 LLM Wiki 的核心区别是什么？
- Pages consulted: concepts/rag.md, concepts/llm-knowledge-bases.md
- Filed back: yes → comparisons/rag-vs-wiki.md
```

日志用统一前缀格式，所以可以直接用 grep 解析：

```bash
grep "^## \[" wiki/log.md | tail -5    # 最近 5 条操作
grep "ingest" wiki/log.md | wc -l      # 一共摄入了多少来源
```

### 查询（Query）

对 wiki 问问题。LLM 搜索相关页面，阅读它们，综合出带引用的回答。

回答不一定是纯文本。根据问题性质，可以是 markdown 页面、对比表格、Marp 幻灯片、matplotlib 图表。Karpathy 在 Obsidian 里直接查看这些输出。

这里有个关键的洞察：**好的回答可以回填到 wiki 作为新页面。** 你做的一次对比分析、发现的一个跨领域关联——这些不应该消失在聊天历史里。回填之后，你的探索和查询也在 wiki 中"积累"，和摄入新来源的效果一样。

几个查询 prompt 的例子：

```
# 事实性查询
Wiki 里关于 Karpathy 对 RAG 的看法记录了什么？

# 跨来源综合
基于 wiki 中所有内容，LLM 能力天花板最有可能受限于什么因素？引用具体来源。

# 空白识别
Wiki 里关于 AI 安全的内容有什么明显的空白？接下来应该找什么来源？

# 指定输出格式
把 wiki 中关于 AI 监管的内容整理成 5 页 Marp 幻灯片，保存到 assets/ai-regulation-slides.md。
```

### 健康检查（Lint）

定期让 LLM 给 wiki 做体检。具体检查项：

- 页面之间的矛盾——新来源可能推翻了旧结论
- 过时的内容——被更新的数据取代了
- 孤立页面——没有任何入链
- Stub 页面——创建了但内容不到 100 字的占位符
- 缺失页面——在多个地方被 wikilink 引用但不存在的页面
- Frontmatter 不一致——缺少必填字段、source_count 和实际来源数对不上
- raw/ 里还没摄入的文件

LLM 还擅长一件事：建议下一步该调查什么问题、该找什么新来源。这让 wiki 在增长过程中保持健康。

一次 lint 的输出长这样：

```markdown
# Wiki Lint Report — 2026-04-06

## Contradictions (1)
- concepts/scaling-laws.md 声称训练数据已接近耗尽，
  但 sources/new-synthetic-data-paper.md 的结论相反

## Orphan Pages (2)
- entities/some-tool.md — 无入链
- concepts/old-framework.md — 无入链

## Stubs (3)
- entities/dario-amodei.md (42 words)

## Un-ingested Sources (2)
- raw/papers/unprocessed.pdf

## Suggested Next Steps
- 摄入那 2 个未处理的来源
- 扩展 Dario Amodei 实体页面
- 解决 scaling-laws 的矛盾
```

## 工具链深度

### Obsidian：Wiki 的 IDE

Karpathy 用 Obsidian 作为前端，一边开着 LLM agent，一边开着 Obsidian。他的原话是 "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."——Obsidian 是 IDE，LLM 是程序员，Wiki 是代码库。**你很少手动编辑 wiki 的内容，就像你很少手动编辑编译产物一样。**

几个关键的 Obsidian 插件：

**Obsidian Web Clipper** 是浏览器扩展，一键把网页文章转成 markdown 保存到本地 vault。支持 Chrome、Firefox、Safari、Edge 等所有主流浏览器。它有一套模板系统，可以自动提取文章标题、作者、发布日期等元数据。Karpathy 建议把 Ctrl+Shift+D 绑定为"下载当前文件的附件"——这样文章里的图片也会被本地化，LLM 可以直接引用。

**Graph View** 是 Obsidian 自带的图谱视图，直观看到 wiki 的结构——什么和什么相连、哪些页面是枢纽、哪些是孤立的。对 lint 操作特别有用——孤立节点一目了然。

**Dataview** 把 Obsidian vault 当作数据库，对页面的 frontmatter 做动态查询。有了规范的 frontmatter，你可以在 Obsidian 里创建动态视图：

```dataview
TABLE source_count, updated, confidence
FROM "wiki/concepts"
WHERE status = "needs-update"
SORT updated ASC
```

这会自动生成一张表格，列出所有需要更新的概念页面，按最后更新时间排序。

**Marp** 是基于 markdown 的幻灯片格式。LLM 可以从 wiki 内容直接生成演示文稿，格式是在 markdown 里用 `---` 分隔幻灯片。CLI 支持导出为 HTML、PDF、PowerPoint。

### qmd：Wiki 的搜索引擎

当 wiki 增长到 index.md 不够用的规模时，需要搜索引擎。Karpathy 提到的 [qmd](https://github.com/tobi/qmd) 是 Shopify CEO Tobi Lutke 做的本地 markdown 搜索引擎。

安装：

```bash
npm install -g @tobilu/qmd
```

首次运行会自动下载三个本地模型（总计约 2GB）——嵌入模型、重排序模型和查询扩展模型。全部在本地运行，不依赖外部 API。

qmd 有三种搜索模式：

```bash
qmd search "authentication flow"    # BM25 全文检索（最快）
qmd vsearch "how to login"          # 纯向量语义搜索
qmd query "user authentication"     # 混合搜索 + LLM 重排序（最佳质量）
```

`qmd query` 的混合搜索管线相当精细——7 步流程：查询扩展 → 并行 BM25 + 向量检索 → RRF 融合 → Top-K 选取 → LLM 重排序 → 位置感知混合。Chunk 策略是 ~900 token/块、15% 重叠，按 markdown 标题和代码块边界智能切分。

对 LLM Wiki 来说，qmd 最重要的能力是 **MCP Server 模式**。把它配置进 Claude Code：

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "qmd": {
      "command": "qmd",
      "args": ["mcp"]
    }
  }
}
```

这样 Claude Code 就多了 4 个 MCP 工具：`query`（混合搜索）、`get`（文档检索）、`multi_get`（批量检索）、`status`（索引状态）。查询 wiki 时，Claude Code 先通过 qmd 找到相关页面，再用 Read 工具深入阅读——比翻阅整个 index.md 高效得多。

什么时候该从 index.md 切换到 qmd？大约在 100-150 个 wiki 页面时。此时 index.md 大约 5000-8000 tokens，还能勉强工作。到 300+ 页面时，index 本身就要消耗 15K+ tokens 的 context——那就必须上搜索了。

整个 wiki 就是一个 git 仓库里的 markdown 文件。版本历史、分支、多人协作——全都是现成的。`git diff wiki/` 看 LLM 改了什么，`git log --oneline wiki/concepts/rag.md` 看某个页面的演变历史。出了问题？`git checkout` 回退就行。

## 从 Memex 到 LLM Wiki：八十年的思想谱系

Karpathy 在 Gist 里提到了 Vannevar Bush 1945 年的 Memex 构想。顺着这条线往回翻，LLM Wiki 的思想根基比大多数人以为的要深得多。

### Memex（1945）

1945 年 7 月，Vannevar Bush 在 The Atlantic 发表了 "As We May Think"。Bush 当时是美国科学研究与发展局（OSRD）局长，二战期间负责协调 6000 名科学家的军事研究。文章写于战争末期，他在思考：科学家们积累了海量知识，但获取和组织这些知识的方式还停留在中世纪。

他设想的 Memex 是一张桌子大小的设备，用缩微胶片存储所有书籍、记录和通信，可以极高速地检索。但 Memex 真正的创新不在存储，在于他称之为 **"关联性路径"（Associative Trails）** 的概念：

> The human mind does not work that way. It operates by association.

人类思维不按传统分类体系工作，它按关联运作。

Bush 描述了具体的操作：用户敲击一个键，两个项目就被永久连接起来。多个项目形成路径，可以快速翻阅。更重要的是，**路径可以分享**——他描述了一个研究者研究弓箭历史的场景：研究者建立了一条穿越百科全书和教科书的路径，然后"拍下整条路径，传给朋友插入朋友自己的 Memex 中"。

万维网（Tim Berners-Lee, 1989）实现了 Bush 构想的一小部分——超链接。但 Web 的链接是单向的、公开的、没人维护的。Memex 的核心特征是：私有的、主动策划的、**文档间的连接和文档本身一样有价值**。这三点恰好是 LLM Wiki 的特征。

Bush 没能解决的问题是谁来做维护。八十年后，LLM 接手了。

### Zettelkasten（1950s-1998）

德国社会学家 Niklas Luhmann 从 1950 年代开始用一套卡片盒（Zettelkasten）系统管理知识。到他 1998 年去世时，积累了超过 **9 万张索引卡**。每张卡只包含一个原子化的想法，通过编号系统和标签互相链接。他用这套系统产出了 70 本书和 400 多篇学术论文。

Luhmann 在 1981 年的论文 "Kommunikation mit Zettelkästen" 中解释了这套方法的核心：卡片盒是一个"对话伙伴"——你向它提出问题，它通过关联链接给出你没预料到的答案。

Sonke Ahrens 2017 年的《How to Take Smart Notes》使 Zettelkasten 在数字时代复兴，直接催生了 Roam Research（2019）和 Obsidian（2020）。

### 这条谱系意味着什么

Hacker News 上一篇分析文章把这条线索概括为：

> Bush (vision, 1945) → Luhmann (manual discipline, 1950s-90s) → Karpathy (automated maintenance, 2026)

Bush 构想了愿景，Luhmann 用人力纪律实现了它（9 万张卡片），Karpathy 用 LLM 自动化了维护。

Tiago Forte 的"第二大脑"方法（2022 年出版的 Building a Second Brain）定义了 CODE 框架：Capture → Organize → Distill → Express。LLM Wiki 的突破在于：**它把 Organize 和 Distill 这两步自动化了。** 人类只负责 Capture（策展来源）和高层的 Express（提出问题、解读结论）。

## "Idea File"：分享想法，不分享代码

第一条推文火了之后，很多人问 Karpathy 能不能把代码开源。他的回应出人意料——没有发代码，发了一份详细的"idea file"（就是那个 GitHub Gist）。

**在 LLM Agent 时代，分享具体的代码和应用意义不大了。你只需要分享想法，对方的 Agent 会根据他们的需求定制并构建。** 他的原文是 "you just share the idea, then the other person's agent customizes & builds it for your specific needs."

想想看，一个知识库系统的目录结构、页面格式、schema 约定——这些高度依赖领域和个人偏好。一个研究 AI 论文的人和一个做竞品分析的人，wiki 结构完全不同。与其开源一套固定实现让大家去改，不如写清楚思路。Gist 结尾也说了——"This document is intentionally abstract. It describes the idea, not a specific implementation. Your LLM can figure out the rest." 文档故意写得抽象，你的 LLM 能搞定剩下的。

Karpathy 在 Gist 里列的应用场景挺有启发性：

| 场景 | 怎么用 |
|------|-------|
| 个人成长 | 追踪目标、健康、心理状态——把日记、文章、播客笔记归档，逐渐建立结构化的自我图谱 |
| 深度研究 | 在一个主题上持续几周或几个月——读论文、文章、报告，增量构建有演进论点的综合 wiki |
| 读书 | 逐章归档，为角色、主题、情节线建页面并关联。想想 [Tolkien Gateway](https://tolkiengateway.net/wiki/Main_Page) 那样的粉丝 wiki |
| 团队内部 | LLM 维护的内部 wiki，输入来自 Slack 对话、会议记录、项目文档 |
| 商业分析 | 竞品分析、尽职调查、行业研究——任何你在持续积累知识并希望它有组织的场景 |

## 社区实现

推文发出不到一周，GitHub 上就涌现了大量实现。挑几个有代表性的：

[llm-wiki-compiler](https://github.com/ussumant/llm-wiki-compiler)（目前星数最高的实现）是一个 Claude Code 插件，在 383 个 markdown 文件（13.1MB）的实测中，**token 消耗降低了 84%**（47K → 7.7K）。它给每个 wiki 章节标注覆盖度（High/Medium/Low + 来源文件数量），让你知道哪些内容基础扎实，哪些还单薄。核心命令：

```bash
/wiki-init          # 初始化 wiki 结构
/wiki-compile       # 编译原始文档进 wiki
/wiki-query         # 查询 wiki
/wiki-lint          # 健康检查
```

[karpathy-wiki](https://github.com/toolboxmd/karpathy-wiki)（toolboxmd）是两个 Claude Code 技能（skill），安装后直接对 Claude Code 说 "Initialize a wiki for my research on [topic]" 就行。

[sage-wiki](https://github.com/xoai/sage-wiki)（xoai）走了独立工具的路线，支持概念自动提取、交叉引用发现和全文搜索，不依赖特定的 LLM agent 框架。

有人还做了 **awesome-llm-knowledge-bases** 的 awesome list，收录了 80+ 相关工具，覆盖数据摄入、wiki 编译、搜索、可视化、agent 框架等完整管线。

VentureBeat 的报道中引用了企业家 Vamshi Reddy 的评论：

> Every business has a raw/ directory. Nobody's ever compiled it. That's the product.

每家公司都有一个 raw/ 目录（散落在 Slack、邮件、会议记录里的知识）。从来没有人把它编译过。这就是产品机会。

## 为什么这个想法能成立

这条推文引起 9 万次收藏，因为它击中了一个真实的痛点。

维护知识库最烦人的部分永远是记账。更新交叉引用、保持摘要是最新的、在几十个页面之间维持一致性。人类放弃 wiki 是因为**维护成本的增长速度超过了使用价值的增长速度**。Notion 里建的知识库、语雀上写的文档、Obsidian 里规划好的笔记体系——多少人用了两周就荒废了？McKinsey 的数据说员工每天花 1.8 小时搜索信息。

LLM 不会觉得无聊，不会忘记更新一个交叉引用，可以一次修改 15 个文件。Wiki 能持续运转下去，是因为维护成本接近于零。

> The human's job is to curate sources, direct the analysis, ask good questions, and think about what it all means. The LLM's job is everything else.

**人类的工作是策展来源、引导分析、问好问题、思考这一切意味着什么。LLM 的工作是除此之外的一切。**

## 参考资料

- [Karpathy Tweet 1: LLM Knowledge Bases](https://x.com/karpathy/status/2039805659525644595)
- [Karpathy Tweet 2: Idea File](https://x.com/karpathy/status/2040470801506541998)
- [GitHub Gist: llm-wiki.md](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [qmd - Local Markdown Search Engine](https://github.com/tobi/qmd)
- [Vannevar Bush, "As We May Think", The Atlantic, July 1945](https://web.mit.edu/sts.035/www/PDFs/think.pdf)
- [Selman & Kautz, "Knowledge Compilation and Theory Approximation", JACM 1996](https://www.cs.cornell.edu/selman/papers/pdf/96.jacm.knowlcomp.pdf)
- [Mintlify: How We Built a Virtual Filesystem for Our Assistant](https://www.mintlify.com/blog/how-we-built-a-virtual-filesystem-for-our-assistant)
