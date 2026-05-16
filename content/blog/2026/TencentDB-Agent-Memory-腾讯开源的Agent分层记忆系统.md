---
title: "TencentDB Agent Memory：腾讯开源了一套 Agent 分层记忆系统"
date: 2026-05-14T20:20:17+08:00
draft: false
featured_image: "https://img.riba2534.cn/images/2026/05/tdai-agent-memory-cover.jpg"
description: "TencentDB Agent Memory 是腾讯开源的 Agent 记忆系统：长期记忆走 L0→L1→L2→L3 语义金字塔，短期记忆走 Mermaid 符号化压缩。本文拆解它的核心架构与设计哲学。"
tags:
- AI Agent
- 记忆系统
- 开源项目
- 腾讯
- LLM
categories:
- AI
comment: true
---

做 Agent 应用的人，应该都被两个问题折磨过。

第一个是上下文爆炸。一个稍微复杂点的任务，Agent 来回调几十次工具，单条 search 结果几千 token，一个 bash 报错栈又是几千，跑十几轮上下文就上 10 万 token 了。再继续跑，要么 LLM 开始遗忘前面发生过什么，要么钱包先扛不住。

第二个是记忆漂移。你上次跟 Agent 说"我们的代码用四空格缩进"，过两天新开 session 它又开始往里塞两空格的代码。你跟它说过的所有偏好、约束、上下文，在新对话里都得从零开始。

这两个问题其实是同一个问题的两面：**Agent 没有像样的记忆系统**。要么把所有历史一股脑塞进上下文（暴力堆砌），要么搞个 RAG 把对话切片扔进向量库（不可逆压缩）——两种方案各有各的坑。

5 月 14 日，腾讯开源了 [TencentDB-Agent-Memory](https://github.com/Tencent/TencentDB-Agent-Memory)，定位是给 Agent 用的"分层记忆系统"。这篇文章对它的核心架构进行拆解。


## 它在做什么

TencentDB Agent Memory（以下简称 TDAI，对应它源码里的命名）的设计哲学只有一句：**拒绝平铺，走向分层与符号化**。

具体到产品形态是两条独立的记忆链路：

- **长期记忆**：把跨会话的碎片对话，层层提炼成有结构的用户画像（L0 对话 → L1 原子事实 → L2 场景 → L3 画像）
- **短期记忆**：把单次长任务中繁杂的工具日志，压缩成一张轻量级的 Mermaid 任务地图（refs/*.md → offload.jsonl → mmds/*.mmd）

两条链路共享同一套溯源机制：**高层符号 → 中层索引 → 底层原文**，任何摘要都 100% 可恢复。

它把整个架构画在一张图里就是下面这个样子：

![TDAI 双轴架构总览](https://img.riba2534.cn/images/2026/05/tdai-board1_overview.png)

接下来分别拆这两条链路。

## 长期记忆：L0→L3 语义金字塔

这部分是 TDAI 最容易让人混乱的地方，因为四层抽象每一层都有自己的触发条件、产物格式、LLM 工具沙箱。但拆开看其实很清晰。

![长期记忆 L0-L3 金字塔](https://img.riba2534.cn/images/2026/05/tdai-board2_pyramid.png)

### L0 Conversation：获取即存

L0 是最底层，做的事是"原汁原味地把每条消息记下来"。每当 Agent 一轮对话结束（`agent_end` 事件触发），系统会把新消息按 JSONL 格式 append 到 `conversations/YYYY-MM-DD.jsonl`。

值得一提的是它的去重策略——双层保护。位置切片（缓存 `originalUserMessageCount`）+ 时间戳游标（`afterTimestamp`）。Gateway 重启时位置缓存失效，时间戳兜底；正常运行时位置切片更快。

每条 L0 消息都会生成一个 `msg_${timestamp}_${randomHex}` 的唯一 ID——**这个 ID 是后面所有层级溯源的钥匙**。L1 提取时会把它记进 `source_message_ids`，L2 总结时会保留对 L1 的引用，L3 画像可以一直追溯回原始对话。

代码位置在 `src/core/conversation/l0-recorder.ts:270-298`。

### L1 Atom：原子事实

L1 干的是"把对话翻译成结构化记忆"的活。一条 L1 记忆长这样：

```typescript
{
  content: "用户偏好用 Go 语言写后端服务",
  type: "persona",         // persona | episodic | instruction
  priority: 80,             // 0-100，-1 表示全局指令
  source_message_ids: ["msg_xxx_abc", "msg_yyy_def"],
  scene_name: "技术偏好",
  metadata: { start: "2026-05-10", end: "2026-05-14" }
}
```

L1 的触发逻辑里我最欣赏的是**指数级 Warm-up**——新会话采用指数递增节奏：第 1、2、4、8、16 轮分别触发一次，之后才回到固定周期（默认 `everyNConversations=5`）。另外还有 `l1IdleTimeoutSeconds`（默认 600s）做空闲兜底——用户停止对话超过 10 分钟也会强制触发一次提取。这种自适应策略贴合了真实场景：用户和 Agent 的交互前期最密集、信息量最大，后期相对稳定。早期密集学习捕捉用户特征，后期低频维护省成本。代码在 `src/utils/pipeline-manager.ts:480-510`。

L1 的去重做得也有意思——三层降级：

```
Tier 1: 向量召回（VectorStore + Embedding，余弦 Top-K=5）
   ↓ 向量不可用
Tier 2: BM25（SQLite FTS5 关键字搜索）
   ↓ 都不可用
Tier 3: 直接写入（保险丝设计，不阻塞主流程）
```

召回候选之后让 LLM 做四元决策：`store`（追加）、`update`（覆盖）、`merge`（融合双时间戳）、`skip`（丢弃）。所有决策在单次 LLM 调用里完成，不会拖慢 pipeline（`src/core/record/l1-dedup.ts:58-120`）。

### L2 Scenario：场景叙事块

L2 把若干条 L1 原子事实聚合成有"叙事连贯性"的 Markdown 文档。每个 scene block 长这样：

```markdown
-----META-START-----
created: 2026-05-10T12:00:00
updated: 2026-05-14T20:00:00
summary: 用户在 5 月份参与了 TDAI 项目调研，期间多次表达对...
heat: 17
-----META-END-----

# 技术偏好与项目背景

用户是一名后端工程师，从 5 月初开始关注 Agent 记忆系统这个方向...
（继续叙事）
```

我特别想聊聊 L2 的一个**反直觉决定：用 Markdown 而不是数据库**。

第一反应可能会想：场景是结构化的，存数据库不更好查吗？但仔细想 L2 的使用场景——LLM 在沙箱里要持续读、改、增、删这些场景文件。给它一个 Markdown 画布让它直接 `read / write / edit`，远比经过数据库 schema 约束更高效；同时工程师能直接打开 `scene_blocks/*.md` 看到当前状态，"白盒可调"成为现实。

如果你做过 Agent 工具调用，会知道让 LLM 操作文件系统的成本远低于让它操作数据库——LLM 本身就是在文本上推理的，给它文本接口是顺水推舟。

L2 的触发策略叠了好几层保险：L1 完成后延迟 90s 触发；同一 session 两次 L2 至少间隔 15 分钟（默认 900s）；超过 1h 没触发会强制触发一次；session 24h 无活动则取消定时器避免资源浪费（`src/core/scene/scene-extractor.ts:88-150`）。

### L3 Persona：四层认知画像

L3 是金字塔的尖顶——**单一**的 `persona.md` 文件（最多 2000 字），由 LLM 用一种"四层深度扫描"策略生成：

| 层级 | 提炼维度 | 典型用途 |
|------|---------|---------|
| Layer 1 Base & Facts | 人口学、现状、确凿事实 | 破冰话题 |
| Layer 2 Interest Graph | 投入时间/金钱的领域（活跃/被动/休眠） | 高质量闲聊 |
| Layer 3 Interface Protocol | 沟通习惯、雷区、工作流偏好 | 怎么说话、怎么交付 |
| Layer 4 Cognitive Core | 决策逻辑、矛盾点、终极驱动力 | 替代决策能力 |

触发逻辑五优先级：① 主动请求 → ② 冷启动 → ③ 正文丢失恢复 → ④ 首个 scene 完成 → ⑤ 定时（≥24h+ 新 L1）（`src/core/persona/persona-trigger.ts:36-80`）。

`persona.md` 末尾会自动追加 Scene Navigation 索引，列出所有活跃场景的绝对路径、heat、摘要。Agent 看到画像后想考证细节，直接按路径下钻 scene_block 即可。这就是它在 README 里反复强调的"渐进式披露"——高层结构注入上下文，底层证据按需读取。

## 短期记忆：Context Offload + Mermaid

聊完长期记忆，来看更有意思的部分——短期记忆。这部分是 TDAI 区别于其他记忆系统的核心创新。

![短期记忆 Offload 三段流水线](https://img.riba2534.cn/images/2026/05/tdai-board3_offload.png)

### 为什么是 Mermaid

短期记忆要解决的问题很具体：**Agent 跑长任务时，工具调用日志会快速吃掉上下文窗口**。一次 grep 几百行结果、一次 schema dump 上千行 JSON、一次报错栈又是几千 token——堆个十几轮就把上下文堆满了。

主流做法是把历史压成自然语言 summary 塞回去，但这种"不可逆摘要"会丢证据。Agent 想回头查"我刚才那次 grep 到底匹配了哪些路径"，summary 里只有"已检查相关文件"——没用。

TDAI 的解法是：把完整的工具调用结果卸载到外部文件，上下文里只留一张 Mermaid 流程图，标注每个节点对应的 `node_id`。Agent 看着这张图推理，需要细节时凭 `node_id` grep 一下 `refs/*.md` 就能瞬间找回原文。

为什么是 Mermaid 而不是 JSON 或自然语言？

Mermaid 本身是一种形状符号语言——菱形代表决策、矩形代表操作、红色代表错误。形状即语义，不需要太多文字描述就能传递"这里出错了"或者"这里是判断点"。这种压缩率是 JSON 和自然语言都做不到的。

更重要的是 Mermaid 在 LLM 训练语料里高频出现，模型理解成本极低。生成新节点不用重写整张图，单行 `replace` 就能把状态从 todo 改到 doing 再到 done。配合 `node_id` 这种稳定符号，上下文里只放编号，要细节时 grep 到底层 refs/*.md，**既极致省 Token 又完全不丢证据**。

读 L2 的提示词文件 `src/offload/local-llm/prompts/l2-prompt.ts` 你会发现，腾讯反复强调"Token 克制"——单条 summary 上限 100-150 字，整个 MMD 文件不超过 4000 字。这种刻意的极简主义贯穿整个 offload 模块。

### 三阶段流水线

短期记忆走 L1 → L1.5 → L2 三个阶段（注意这里的 L1/L2 跟长期记忆的 L1/L2 不是一回事，命名空间是独立的）：

```
工具调用结果
  ↓
L1：工具对摘要（after-tool-call 触发，pending ≥ 4）
  → offload.jsonl 每行一个 OffloadEntry
  → 含 summary、score 0-10（可替代性）、result_ref → refs/*.md
  ↓
L1.5：任务边界判定（before-agent-start 触发）
  → 判断"继续当前任务/新任务/长任务"
  → 决定哪些 entry 归到哪张 MMD 图
  ↓
L2：Mermaid 图谱生成（独立轮询）
  → 触发条件：null 条目 ≥ 4 或上次 ≥ 300s
  → 产物：mmds/*.mmd，flowchart 格式
  → 节点命名 {prefix}-N{n}
  → node_mapping 哈希表：tool_call_id → node_id
```

整套流程下来，本来要塞进上下文的几十万 token 工具日志，最后变成上下文里几百 token 的 Mermaid 节点图。

### 三档压缩：从智能替换到应急止血

光有压缩还不够，还得控制上下文水位。TDAI 做了三档分级压缩，触发阈值是上下文窗口占用率：

![三档压缩光谱](https://img.riba2534.cn/images/2026/05/tdai-board4_compression.png)

简单总结一下三档的性格：

- **Mild 温和（50%）**：像管家，按 `offload score` 从高到低逐条替换最可替代的工具结果，保护当前任务的工具对不动
- **Aggressive 激进（85%）**：像搬家工，从最旧消息开始删，目标删除占消息 token 的 40%，删完注入 history MMD 做补偿
- **Emergency 应急（95%）**：像急救包，激进删至 60% 占用，至少保留 4 条消息

中间的 50% 到 85% 这一段是 Mild 的舒适区——有足够空间慢慢替换不可替代的工具结果，避免频繁切到 Aggressive。

Token 计算上它用的是 `js-tiktoken`（GPT-4o 级 `o200k_base` BPE 编码），WeakMap 缓存每条消息的 token 数，`_offloaded` 这种内部标记 key 不计入。tiktoken 加载失败时降级到启发式（中文 1.7 字/token）。这套精度 + 降级在生产环境里挺稳。

### 五个钩子的协作时序

短期记忆的所有动作都嵌在 Agent 一轮对话的五个钩子里：

![五钩子时序图](https://img.riba2534.cn/images/2026/05/tdai-board5_hooks.png)

一轮对话的完整路径：

```
1. before_agent_start  → L1.5 判任务边界，激活 MMD
2. after_tool_call (×N) → 累积 ToolPair，触发 L1，inline 压缩，增量更新 MMD
   [后台异步] L2 轮询 → 生成/更新 Mermaid 图
3. before_prompt_build  → 快速路径复用替换，full L3 兜底，MMD 注入
4. llm_input            → tiktoken 精确检查，Mild/Aggressive/Emergency 三档兜底
5. llm_output           → 检查是否要强制触发 L1（pending 超阈值）
```

特别提一下 `after_tool_call` 这个钩子——为了让它在 OpenClaw 宿主里能拿到完整的工具调用消息，TDAI 还提供了一个 patch 脚本 `scripts/openclaw-after-tool-call-messages.patch.sh`，install 时执行一次就好。这种"把宿主兼容补丁打包进仓库"的做法挺工程化的。

## 双宿主：一份核心、两种部署

聊完两条记忆链路，再看 TDAI 的另一个亮点——它不绑定特定 Agent 框架。

![双宿主架构对比](https://img.riba2534.cn/images/2026/05/tdai-board6_dualhost.png)

核心引擎 `TdaiCore` 是纯 TypeScript 实现，**只依赖三个抽象接口**：`HostAdapter`、`LLMRunner`、`LLMRunnerFactory`。两种宿主各自实现这套接口：

| 维度 | OpenClaw 插件模式 | Hermes Standalone Gateway |
|------|------|------|
| 部署方式 | `openclaw plugins install` | `docker run` 单命令 |
| 模型来源 | 借用宿主 `runEmbeddedPiAgent` | 直调 OpenAI 兼容 API |
| 触发方式 | hook 被动触发 | HTTP 接口主动调用 |
| 数据目录 | `~/.openclaw/memory-tdai/` | `~/.memory-tencentdb/memory-tdai/` |
| 进程管理 | 跟随宿主生命周期 | Python Supervisor 拉起 Node 子进程 |

Hermes 模式的设计值得多说两句。Hermes 是 Python Agent 框架，没法直接加载 Node.js 代码。TDAI 的解法是：

1. Python 写一个 `GatewaySupervisor`，负责拉起 Node.js Gateway 子进程
2. Gateway 暴露 7 个 HTTP 接口：`/health`、`/recall`、`/capture`、`/search/memories`、`/search/conversations`、`/session/end`、`/seed`
3. 健康检查轮询 0.5s 间隔、30s 超时，crash 自动重启

Python 端有个 `MemoryTencentdbSdkClient`，封装了所有 Gateway 调用。环境变量统一：Hermes 端 `MEMORY_TENCENTDB_LLM_API_KEY` → 子进程 `TDAI_LLM_API_KEY`，模型凭据从外到里一路透传。

这套架构的好处是：你想接入新框架不用改 `TdaiCore`，只要实现一个 HTTP client + 一个 supervisor 就行。Slack Bot、自定义 Agent、Hermes、未来的任何 Agent 框架都能挂上来——**一份核心、N 种部署**。

## 存储与检索：双后端 + 混合召回

这里我想纠正一个容易产生的误解：很多人看到 L2/L3 是 Markdown，会以为 TDAI 是个"纯文件系统记忆"。实际不是。

它是个 **SQLite + 文件系统的双底座**：

| 层级 | 介质 | 内容 |
|------|------|------|
| L0 对话 | SQLite + JSONL | 结构化副本 + 原始日志 |
| L1 原子事实 | SQLite (13 列元数据 + vec0 向量虚表 + FTS5 全文索引) | 结构化主战场 |
| L2 场景 | Markdown | LLM 直接编辑 |
| L3 画像 | Markdown | 单文件 ≤2000 字 |
| 工具原文 | Markdown (refs/*.md) | 按 node_id grep |
| Mermaid 地图 | .mmd 文件 | 符号化任务画布 |

数据库部分基于 SQLite + [sqlite-vec](https://github.com/asg017/sqlite-vec)，建了几张关键表：

- `l1_records`：L1 元数据，13 列字段，6 单列索引 + 2 复合索引
- `l1_vec`：`vec0` 虚拟表存 embedding，cosine 距离
- `l1_fts`：FTS5 全文索引，带 jieba 中文分词
- `l0_conversations` + `l0_vec` + `l0_fts`：对话层对应的三件套
- `embedding_meta`：当前 embedding 配置（provider/model/dimensions），变更时触发重索引

读 `src/core/store/sqlite.ts:1004-1103` 你会看到一个有意思的实现细节——`vec0` 虚拟表不支持 `ON CONFLICT`，所以 upsert 实现成 DELETE + INSERT；写入时跳过零向量（norm=0），避免污染 KNN 召回。

也支持切到腾讯云 TCVDB（云端向量库）。两种后端共用同一个 `IMemoryStore` 抽象，通过 `factory.ts` 工厂模式做依赖注入，上层完全无感。

### 混合检索 + RRF

![混合检索 RRF 流向](https://img.riba2534.cn/images/2026/05/tdai-board7_retrieval.png)

检索这块比较经典——BM25 + 向量 + RRF（Reciprocal Rank Fusion）混合召回。三种策略：

```
keyword   → 纯 FTS5 BM25
embedding → 纯 vec0 余弦
hybrid    → 并行 FTS + Vector，RRF k=60 融合（推荐）
```

RRF 的核心就一行公式：`score = Σ 1 / (k + rank + 1)`，k=60 是 Cormack et al. 2009 论文里的标准常数，对任意数量列表的融合都稳健。10 行 TypeScript 实现，无需调参。

中文分词用 jieba 的 `cutForSearch()` 模式——比 `cut()` 多了子词生成。"人工智能" 会被切成 `["人工", "智能", "人工智能"]`，索引时存分词后文本，原文存 `content_original (UNINDEXED)` 仅用于展示。这样查"人工"或"智能"单独都能命中，不必精确匹配整词。配 13 项中文停词表过滤"的、了、在"这类无信息词。

### 五级降级链

向量配置缺失时不会崩，会优雅降级。这是它"零配置即可跑"的底气：

```
Level 1: 完整配置        → hybrid（BM25 + 向量 + RRF）
   ↓ provider="none"
Level 2: 主动关闭向量     → 纯 BM25
   ↓ apiKey/baseUrl/model/dimensions 任一缺失
Level 3: 配置不完整       → 纯 BM25 + configError 标记
   ↓ 调用时网络失败
Level 4: 运行时失败       → 纯 BM25（捕获 EmbeddingNotReadyError）
   ↓ 完全无网络
Level 5: 离线模式         → Local provider（node-llama-cpp + embeddinggemma-300m）
```

最后还有一道 jieba 不可用时的兜底：`/[\p{L}\p{N}_]+/gu` Unicode 正则分词。也就是说，**你完全可以零成本跑起来**——不配 embedding、不配网络、本地一台机器就能体验全部功能，只是召回质量会从 hybrid 降到 BM25。

## Benchmark 与 Roadmap

数据这块也不藏着掖着，README 里直接放了在 OpenClaw 上加载本插件后的 4 大 Benchmark 实测：

![Benchmark + Roadmap](https://img.riba2534.cn/images/2026/05/tdai-board8_benchmarks.png)

| 能力 | Benchmark | OpenClaw 原版 | 加插件后 | 成功率变化 | Token 节省 |
|------|---|---|---|---|---|
| 短期 | **WideSearch** | 33% | 50% | **+51.52%** | **−61.38%** |
| 短期 | **SWE-bench** | 58.4% | 64.2% | +9.93% | −33.09% |
| 短期 | **AA-LCR** | 44.0% | 47.5% | +7.95% | −30.98% |
| 长期 | **PersonaMem** | 48% | 76% | **+59%** | — |

里面一个值得特别说的概念是**超长 Session 评测**：评测方式不允许单题清空上下文，必须把多个任务拼接到同一 Session 中连续执行（SWE-bench 每 Session 连续跑 50 道题）。这种评测方式真实模拟了长程 Agent 的上下文累积压力——这才是生产环境会遇到的情况。

WideSearch 的成绩有意思：成功率涨 50%，Token 反而省 60%。换句话说，少了一半多的 Token 反而能多解一半的题——上下文压缩不光省钱，还能让模型注意力更集中在关键信息上。

Roadmap 里还在路上的三件事我觉得都值得关注。

第一件是**记忆可迁移**——跨 Agent、跨框架、跨设备的导入导出与热迁移。L2/L3 既然已经是 Markdown，文件搬运 + schema 升级理论上不难做。

第二件是 **Skill 自动生成**，从执行轨迹和报错日志中归纳出可复用的 SOP。把分层思路延伸到"动作域"——Traces → Patterns → Skills，这条路线如果真能跑通，意味着 Agent 能从过往任务里"学手艺"。

第三件是**可视化调试面板**，对标 Chrome DevTools 的记忆 inspector。能看到每条 L1 命中、每张 MMD 的节点状态、压缩前后 token 变化——这个工具如果做出来，Agent 调试的体验会上一个台阶。

## 我的几点观察

几个最有价值的设计决策列在下面。

**L2 用 Markdown 而非数据库** 这个我已经在前面展开聊过，再次强调因为它真的反直觉：很多人下意识会把"场景化记忆"塞进数据库表，但忽略了 LLM 操作文本的成本远低于操作 schema。给 LLM 一个 Markdown 画布，让它直接 read/write/edit，比经过 ORM 抽象更自然。

**source_message_ids 是溯源链的钉子。** L1 写入时强制记录这个字段，让任何高层观点都能秒速回溯到原始对话——所谓"100% 可恢复"的技术基础就是它。很多记忆系统宣传"可追溯"，但底层并没有维护这种 ID 链。

**Warm-up 指数增长（1→2→4→8→16）。** 看似一个小细节，但贴合真实交互模式：用户和 Agent 前期信息量大、后期相对稳定。比起固定每 5 轮触发，Warm-up 既能更及时捕捉初期信号，又能在规模化后节省 compute。这种"前密后疏"的节奏很多记忆系统忽略了。

**node_id 双向锚点。** 上下文里只放 Mermaid 节点编号，要细节时 grep 到 refs/*.md。既极致省 Token，又完全不丢证据。"Token 克制 + 证据保全"二者得兼，是我最欣赏的一个设计。

**RRF k=60 是行业共识。** 这个常数来自 [Cormack et al. 2009 的论文](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)，过去半年我看到的 Agent 工程开源项目几乎都收敛到了 BM25 + 向量 + RRF k=60 这套 hybrid 检索方案。无需调参，跨数据集稳健，是一个不容易出错的默认值。

**HostAdapter 抽象** 让 TdaiCore 完全独立于宿主框架。一份 TypeScript 核心 + 两类适配器（OpenClaw 插件 / Hermes Python Supervisor），新框架只要写个 HTTP client 就能接入。这是开源项目里少见的、把"扩展性"真正落到接口设计层面的做法。

**Patch 脚本打包进仓库。** OpenClaw 版本变更的兼容补丁直接放在 `scripts/bugfix-20260423/`，install 时一键执行。这种"自愈"的工程思路超越了单纯的文档提示——它假设用户不会读 troubleshooting，所以把修复脚本前置到了安装流程里。


## 安装与使用

OpenClaw 用户接入只要两步：

```bash
openclaw plugins install @tencentdb-agent-memory/memory-tencentdb
openclaw gateway restart
```

然后在 `~/.openclaw/openclaw.json` 里加：

```jsonc
{
  "memory-tencentdb": {
    "enabled": true
  }
}
```

默认走 SQLite + sqlite-vec 本地后端，零配置即可跑。需要短期记忆压缩的话再加：

```jsonc
{
  "memory-tencentdb": {
    "config": {
      "offload": {
        "enabled": true
      }
    },
    "plugins": {
      "slots": {
        "contextEngine": "openclaw-context-offload"
      }
    }
  }
}
```

并执行一次 patch：

```bash
bash scripts/openclaw-after-tool-call-messages.patch.sh
```

Hermes 用户走 Docker：

```bash
docker run -d \
  --name hermes-memory \
  --restart unless-stopped \
  -p 8420:8420 \
  -e MODEL_API_KEY="your-api-key" \
  -e MODEL_BASE_URL="https://api.lkeap.cloud.tencent.com/v1" \
  -e MODEL_NAME="deepseek-v3.2" \
  -v hermes_data:/opt/data \
  hermes-memory
```

剩下的配置就按需要调了。完整参数表见 `openclaw.plugin.json`，每个字段都有合理默认值，90% 场景零配置即可。

## 结语

Agent 记忆这个领域已经走过了"暴力 RAG"的阶段。

第一代方案是把对话切片扔向量库，靠 embedding 相似度召回——结果发现单纯向量很难解决长程任务的上下文压力。第二代方案开始引入层级抽象，把"如何组织记忆"作为核心问题。这条路线上还有 [字节的 OpenViking](https://github.com/volcengine/openviking)（Agent 上下文文件系统）和 [Karpathy 的 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)（人主导的领域百科），方向各有侧重。TDAI 偏向"Agent 自动捕获 + 双轴分层"——长期走 L0→L3 分层提炼，短期走 Mermaid 符号化压缩，每一层都保留向下钻取的索引。

腾讯这个项目的价值不在于发明了新方法，而在于把这些方法**工程化到生产可用的程度**——双后端、双宿主、五级降级、Benchmark 数据、Patch 脚本、白盒可调试——这些都是论文不会写、社区项目也很少做到的部分。

如果你在做 Agent 产品，被记忆问题折磨过，这个项目值得关注——即使不直接用，里面的设计思路也能给你不少启发，尤其是 Mermaid 符号化压缩和 source_message_ids 溯源链这两个点。

项目地址：[https://github.com/Tencent/TencentDB-Agent-Memory](https://github.com/Tencent/TencentDB-Agent-Memory)

## 参考资料

- [TencentDB-Agent-Memory · GitHub](https://github.com/Tencent/TencentDB-Agent-Memory)
- [OpenViking · GitHub](https://github.com/volcengine/openviking)
- [Karpathy's LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [sqlite-vec · GitHub](https://github.com/asg017/sqlite-vec)
- [Reciprocal Rank Fusion (Cormack et al., 2009)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [OpenClaw](https://github.com/openclaw/openclaw)
- [Hermes Agent · NousResearch](https://github.com/NousResearch/hermes-agent)
