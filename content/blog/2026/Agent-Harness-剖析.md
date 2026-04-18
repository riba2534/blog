---
title: "Agent Harness 的解剖学：Anthropic、OpenAI、LangChain 正在构建的到底是什么"
date: 2026-04-19T02:29:10+08:00
draft: false
featured_image: "https://img.riba2534.cn/images/2026/04/agent-harness-cover.jpg"
description: "深入剖析 Agent Harness（智能体框架）：编排循环、工具、记忆、上下文管理，以及把一个无状态 LLM 改造成能干活的智能体背后的一切。"
tags:
- 转载
- 翻译
- AI Agent
- LLM
- Agent Harness
categories:
- AI
comment: true
---

> 原文链接：[The Anatomy of an Agent Harness](https://x.com/akshay_pachaar/article/2041146899319971922)
>
> 原文作者：[@akshay_pachaar](https://x.com/akshay_pachaar)
>
> 作者简介：Akshay Pachaar，印度 BITS Pilani 毕业，AI 时事通讯 [Daily Dose of Data Science](http://join.dailydoseofds.com) 联合创始人，曾任 LightningAI 的 AI 工程师，持有 3 项专利，在 X 上拥有约 26 万粉丝。长期输出 LLM、AI Agent、RAG 和机器学习相关的技术科普与实践内容。
>
> 翻译说明：本文为英中双语对照翻译，一段英文对应一段中文。

A deep dive into what Anthropic, OpenAI, Perplexity and LangChain are actually building. Covering the orchestration loop, tools, memory, context management, and everything else that transforms a stateless LLM into a capable agent.

一次深入剖析，看看 Anthropic、OpenAI、Perplexity 和 LangChain 到底在构建什么。内容涵盖编排循环、工具、记忆、上下文管理，以及把一个无状态的 LLM 改造成能干活的智能体背后的一切。

You've built a chatbot. Maybe you've wired up a ReAct loop with a few tools. It works for demos. Then you try to build something production-grade, and the wheels come off: **the model forgets what it did three steps ago, tool calls fail silently, and context windows fill up with garbage.**

你做过一个聊天机器人。也许你还接了一套 ReAct 循环、挂了几个工具，演示效果不错。但只要你想往生产级做，整个系统就开始散架： **模型三步之前干过什么自己都不记得了，工具调用静默失败，上下文窗口被垃圾信息塞满。**

The problem isn't your model. It's everything around your model.

问题不在模型本身，而在模型周围的一切。

LangChain proved this when they changed only the infrastructure wrapping their LLM (same model, same weights) and **jumped from outside the top 30 to rank 5 on TerminalBench 2.0** . A separate research project hit a 76.4% pass rate by having an LLM optimize the infrastructure itself, surpassing hand-designed systems.

LangChain 已经证明了这一点：在同一个模型、同一批权重下，他们只改了包裹 LLM 的那层基础设施， **就在 TerminalBench 2.0 上从榜单 30 名开外一路冲到第 5** 。另一项研究让 LLM 自己去优化这层基础设施，做到了 76.4% 的通过率，比人类手工设计的系统还要好。

That infrastructure has a name now: **the agent harness** .

这层基础设施现在有了一个正式名字： **Agent Harness（智能体框架/脚手架）** 。

## What Is the Agent Harness?

## 什么是 Agent Harness？

The term was formalized in early 2026, but the concept existed long before. The harness is the complete software infrastructure wrapping an LLM: orchestration loop, tools, memory, context management, state persistence, error handling, and guardrails. Anthropic's Claude Code documentation puts it simply: the SDK is "the agent harness that powers Claude Code." OpenAI's Codex team uses the same framing, explicitly equating the terms "agent" and "harness" to refer to the non-model infrastructure that makes the LLM useful.

这个术语在 2026 年初才被正式命名，但概念早就存在。所谓 harness，是包裹 LLM 的整套软件基础设施：编排循环、工具、记忆、上下文管理、状态持久化、错误处理、安全护栏。Anthropic 的 Claude Code 文档讲得很直白：SDK 就是「驱动 Claude Code 的 agent harness」。OpenAI 的 Codex 团队用的是同样的说法，明确把「agent」和「harness」这两个词等同起来，指代那些让 LLM 真正有用的非模型基础设施。

I really liked the canonical formula, from LangChain's Vivek Trivedy: **"If you're not the model, you're the harness."**

我很喜欢 LangChain 的 Vivek Trivedy 给出的那句经典定义： **「如果你不是模型，那你就是 harness。」**

Here's the distinction that trips people up. The "agent" is the emergent behavior: the goal-directed, tool-using, self-correcting entity the user interacts with. The harness is the machinery producing that behavior. When someone says "I built an agent," they mean they built a harness and pointed it at a model.

有一个区分点很多人会搞混。「agent」指的是涌现出来的行为——那个有目标、会调工具、能自我纠正、用户直接打交道的实体。harness 则是产生这种行为的那套机器。当有人说「我做了一个 agent」时，其实他说的是「我做了一个 harness，然后指向了某个模型」。

Beren Millidge made this analogy precise in his 2023 essay "Scaffolded LLMs as Natural Language Computers." **A raw LLM is a CPU with no RAM, no disk, and no I/O.** The context window serves as RAM (fast but limited). External databases function as disk storage (large but slow). Tool integrations act as device drivers. The harness is the operating system. As Millidge wrote: "We have reinvented the Von Neumann architecture" because it's a natural abstraction for any computing system.

Beren Millidge 在他 2023 年的文章《Scaffolded LLMs as Natural Language Computers》里把这个类比讲得非常清楚。 **一个原始的 LLM 就是一颗没有 RAM、没有硬盘、没有 I/O 的 CPU。** 上下文窗口扮演 RAM 的角色（快但小）；外部数据库相当于硬盘（大但慢）；工具集成就是设备驱动；harness 则是操作系统。Millidge 写道：「我们重新发明了冯·诺依曼架构」——因为对任何一个计算系统来说，这都是最自然的抽象。

![一台原始 LLM 就是一颗没有操作系统的 CPU，harness 是让它有用的那层 OS](https://img.riba2534.cn/images/2026/04/tweet_2.jpg)

## Three Levels of Engineering

## 三个层次的工程

Three concentric levels of engineering surround the model:

模型之外，围绕着三层同心的工程：

- **Prompt engineering** crafts the instructions the model receives.

- **Prompt 工程** ：设计模型收到的指令。

- **Context engineering** manages what the model sees and when.

- **Context 工程** ：管理模型在什么时候看到什么。

- **Harness engineering** encompasses both, plus the entire application infrastructure: tool orchestration, state persistence, error recovery, verification loops, safety enforcement, and lifecycle management.

- **Harness 工程** ：把上面两层全包进来，再加上整个应用层的基础设施——工具编排、状态持久化、错误恢复、验证循环、安全执行、生命周期管理。

**The harness is not a wrapper around a prompt. It is the complete system that makes autonomous agent behavior possible.**

**harness 不是一个 prompt 外面的包装层。它是让自治 agent 行为成为可能的那一整套系统。**

## The 12 Components of a Production Harness

## 生产级 Harness 的 12 个组件

Synthesizing across Anthropic, OpenAI, LangChain, and the broader practitioner community, a production agent harness has twelve distinct components. Let's walk through each one.

综合 Anthropic、OpenAI、LangChain 以及更广泛的从业者社区的经验，一个生产级的 agent harness 包含十二个清晰可分的组件。下面一个一个讲。

![同心圆架构：LLM 内核 + Runtime + Capabilities + Safety & Scale](https://img.riba2534.cn/images/2026/04/tweet_3.jpg)

### 1. The Orchestration Loop

### 1. 编排循环

This is the heartbeat. It implements the Thought-Action-Observation (TAO) cycle, also called the ReAct loop. The loop runs: **assemble prompt, call LLM, parse output, execute any tool calls, feed results back, repeat until done.**

这是心跳。它实现的是 Thought-Action-Observation（TAO）循环，也叫 ReAct 循环。整个流程是： **组装 prompt，调 LLM，解析输出，执行工具调用，把结果喂回去，重复直到结束。**

Mechanically, it's often just a while loop. **The complexity lives in everything the loop manages, not the loop itself.** Anthropic describes their runtime as a "dumb loop" where all intelligence lives in the model. The harness just manages turns.

机械层面看，它往往就是一个 while 循环。 **复杂度不在循环本身，而在循环管理的所有东西里。** Anthropic 把自己的 runtime 形容为一个「dumb loop」——所有智能都在模型里，harness 只负责管理每一轮。

### 2. Tools

### 2. 工具

Tools are the agent's hands. They're defined as schemas (name, description, parameter types) injected into the LLM's context so the model knows what's available. The tool layer handles registration, schema validation, argument extraction, sandboxed execution, result capture, and formatting results back into LLM-readable observations.

工具是 agent 的手。它们以 schema 的形式（名字、描述、参数类型）注入到 LLM 的上下文里，让模型知道自己有哪些手段。工具层负责注册、schema 校验、参数提取、沙箱执行、结果捕获，以及把结果格式化成 LLM 能读懂的 observation。

Claude Code provides tools across six categories: file operations, search, execution, web access, code intelligence, and subagent spawning. OpenAI's Agents SDK supports function tools (via `@function_tool`), hosted tools (WebSearch, CodeInterpreter, FileSearch), and MCP server tools.

Claude Code 提供了六类工具：文件操作、搜索、执行、Web 访问、代码智能、子 agent 派生。OpenAI 的 Agents SDK 支持函数工具（通过 `@function_tool`）、托管工具（WebSearch、CodeInterpreter、FileSearch）和 MCP server 工具。

### 3. Memory

### 3. 记忆

Memory operates at multiple timescales. Short-term memory is conversation history within a single session. Long-term memory persists across sessions: Anthropic uses CLAUDE.md project files and auto-generated MEMORY.md files; LangGraph uses namespace-organized JSON Stores; OpenAI supports Sessions backed by SQLite or Redis.

记忆工作在多个时间尺度上。短期记忆是单次会话里的对话历史。长期记忆跨会话持久化：Anthropic 用的是 CLAUDE.md 项目文件和自动生成的 MEMORY.md 文件；LangGraph 用的是按命名空间组织的 JSON Store；OpenAI 则用基于 SQLite 或 Redis 的 Sessions。

Claude Code implements a three-tier hierarchy: a lightweight index (~150 characters per entry, always loaded), detailed topic files pulled in on demand, and raw transcripts accessed via search only. **A critical design principle: the agent treats its own memory as a "hint" and verifies against actual state before acting.**

Claude Code 的实现是三层结构：一个轻量级索引（每条约 150 字符，永远加载）、按需拉取的详细主题文件、只能通过搜索访问的原始 transcript。 **一个关键设计原则：agent 把自己的记忆当成「提示」来用，动手之前要先和真实状态对齐验证。**

### 4. Context Management

### 4. 上下文管理

This is where many agents fail silently. The core problem is **context rot: model performance degrades 30%+ when key content falls in mid-window positions** (Chroma research, corroborated by Stanford's "Lost in the Middle" finding). Even million-token windows suffer from instruction-following degradation as context grows.

这是很多 agent 静默失败的地方。核心问题是 **context rot（上下文腐烂）：关键内容一旦落在窗口中段，模型表现会下降 30% 以上** （Chroma 的研究，和斯坦福的「Lost in the Middle」结论互相印证）。哪怕是百万 token 的窗口，上下文一变长，指令遵循能力也会下降。

Production strategies include:

生产环境下常见的策略包括：

- **Compaction** : summarizing conversation history when approaching limits (Claude Code preserves architectural decisions and unresolved bugs while discarding redundant tool outputs)

- **压缩（Compaction）** ：在接近上限时对对话历史做总结（Claude Code 会保留架构决策和尚未解决的 bug，同时丢掉冗余的工具输出）。

- **Observation masking** : JetBrains' Junie hides old tool outputs while keeping tool calls visible

- **Observation 屏蔽** ：JetBrains 的 Junie 隐藏掉旧的工具输出，但保留工具调用本身可见。

- **Just-in-time retrieval** : maintaining lightweight identifiers and loading data dynamically (Claude Code uses grep, glob, head, tail rather than loading full files)

- **即时检索（JIT）** ：只保留轻量级标识符，动态加载数据（Claude Code 用 grep、glob、head、tail，而不是一次性加载整个文件）。

- **Sub-agent delegation** : each subagent explores extensively but returns only 1,000 to 2,000 token condensed summaries

- **子 agent 委派** ：每个 subagent 自己大量探索，但只返回 1,000 到 2,000 token 的浓缩总结。

Anthropic's context engineering guide states the goal: **find the smallest possible set of high-signal tokens that maximize likelihood of the desired outcome.**

Anthropic 的 context 工程指南把目标说得很清楚： **找到最小的一组高信号 token，把达到期望结果的概率最大化。**

### 5. Prompt Construction

### 5. Prompt 构造

This assembles what the model actually sees at each step. It's hierarchical: system prompt, tool definitions, memory files, conversation history, and the current user message.

这一步把模型每一步真正看到的内容组装起来。它是分层的：system prompt、工具定义、记忆文件、对话历史、当前用户消息。

OpenAI's Codex uses a strict priority stack: server-controlled system message (highest priority), tool definitions, developer instructions, user instructions (cascading AGENTS.md files, 32 KiB limit), then conversation history.

OpenAI 的 Codex 采用严格的优先级栈：服务端控制的 system message（最高优先级）、工具定义、开发者指令、用户指令（级联的 AGENTS.md 文件，32 KiB 上限），最后是对话历史。

### 6. Output Parsing

### 6. 输出解析

Modern harnesses rely on native tool calling, where the model returns structured tool_calls objects rather than free-text that must be parsed. The harness checks: are there tool calls? Execute them and loop. No tool calls? That's the final answer.

现代 harness 依赖原生工具调用——模型直接返回结构化的 tool_calls 对象，而不是需要解析的自由文本。harness 只需要检查：有工具调用吗？有就执行并继续循环。没有？那就是最终答案。

For structured outputs, both OpenAI and LangChain support schema-constrained responses via Pydantic models. Legacy approaches like RetryWithErrorOutputParser (which feeds the original prompt, the failed completion, and the parsing error back to the model) remain available for edge cases.

对结构化输出，OpenAI 和 LangChain 都通过 Pydantic 模型支持 schema 约束的响应。老式方法如 RetryWithErrorOutputParser（把原 prompt、失败的补全、解析错误一起喂回模型）在边缘场景下仍然可用。

### 7. State Management

### 7. 状态管理

LangGraph models state as typed dictionaries flowing through graph nodes, with reducers merging updates. Checkpointing happens at super-step boundaries, enabling resume after interruptions and time-travel debugging. OpenAI offers four mutually exclusive strategies: application memory, SDK sessions, server-side Conversations API, or lightweight previous_response_id chaining. Claude Code takes a different approach: **git commits as checkpoints and progress files as structured scratchpads.**

LangGraph 把状态建模成在图节点之间流动的类型化字典，用 reducer 合并更新。checkpoint 发生在 super-step 边界，支持中断后恢复和时间回溯调试。OpenAI 给出四种互斥策略：application memory、SDK sessions、服务端 Conversations API、或者轻量的 previous_response_id 串联。Claude Code 选了另一条路： **git commit 当 checkpoint，进度文件当结构化草稿纸。**

### 8. Error Handling

### 8. 错误处理

Here's why this matters: **a 10-step process with 99% per-step success still has only ~90.4% end-to-end success.** Errors compound fast.

这件事为什么重要？ **一个 10 步流程，哪怕每一步成功率都是 99%，端到端成功率也只有 ~90.4%。** 错误复合得非常快。

LangGraph distinguishes four error types: transient (retry with backoff), LLM-recoverable (return error as ToolMessage so the model can adjust), user-fixable (interrupt for human input), and unexpected (bubble up for debugging). Anthropic catches failures within tool handlers and returns them as error results to keep the loop running. Stripe's production harness caps retry attempts at two.

LangGraph 把错误分成四类：瞬时错误（按退避策略重试）、LLM 可恢复错误（把错误作为 ToolMessage 返回，让模型自己调整）、用户可修复错误（中断等待人类输入）、意外错误（向上冒泡用于调试）。Anthropic 在工具 handler 里捕获所有失败，作为 error result 返回来保证循环继续。Stripe 的生产 harness 把重试次数上限设为 2 次。

### 9. Guardrails and Safety

### 9. 护栏与安全

OpenAI's SDK implements three levels: input guardrails (run on first agent), output guardrails (run on final output), and tool guardrails (run on every tool invocation). A "tripwire" mechanism halts the agent immediately when triggered.

OpenAI 的 SDK 提供三级护栏：输入护栏（在第一个 agent 上执行）、输出护栏（在最终输出上执行）、工具护栏（在每次工具调用时执行）。一旦「tripwire」机制被触发，agent 立刻停机。

Anthropic separates permission enforcement from model reasoning architecturally. **The model decides what to attempt; the tool system decides what's allowed.** Claude Code gates ~40 discrete tool capabilities independently, with three stages: trust establishment at project load, permission check before each tool call, and explicit user confirmation for high-risk operations.

Anthropic 在架构层面把权限执行和模型推理分开。 **模型决定尝试做什么，工具系统决定什么被允许。** Claude Code 对大约 40 个离散的工具能力分别设卡，分三个阶段：项目加载时建立信任、每次工具调用前做权限检查、对高风险操作要求用户显式确认。

### 10. Verification Loops

### 10. 验证循环

This is what separates toy demos from production agents. Anthropic recommends three approaches: rules-based feedback (tests, linters, type checkers), visual feedback (screenshots via Playwright for UI tasks), and LLM-as-judge (a separate subagent evaluates output).

这是把玩具 demo 和生产级 agent 真正分开的一条线。Anthropic 推荐三种路径：基于规则的反馈（测试、linter、类型检查）、视觉反馈（UI 任务用 Playwright 截图）、LLM-as-judge（专门的 subagent 评估输出）。

Boris Cherny, creator of Claude Code, noted that **giving the model a way to verify its work improves quality by 2 to 3x.**

Claude Code 的作者 Boris Cherny 指出： **给模型一个自我验证的办法，质量能提升 2 到 3 倍。**

### 11. Subagent Orchestration

### 11. 子 Agent 编排

Claude Code supports three execution models: **Fork** (byte-identical copy of parent context), **Teammate** (separate terminal pane with file-based mailbox communication), and **Worktree** (own git worktree, isolated branch per agent). OpenAI's SDK supports agents-as-tools (specialist handles bounded subtask) and handoffs (specialist takes full control). LangGraph implements subagents as nested state graphs.

Claude Code 支持三种执行模型： **Fork** （父上下文的字节级副本）、 **Teammate** （独立的终端 pane，通过基于文件的邮箱通信）、 **Worktree** （每个 agent 拥有自己的 git worktree 和隔离分支）。OpenAI 的 SDK 支持 agents-as-tools（专家处理受限子任务）和 handoffs（专家接管全部控制权）。LangGraph 把 subagent 实现为嵌套的状态图。

## The Loop in Motion: A Step-by-Step Walkthrough

## 循环运转：一步一步走一遍

Now that you know the components, let's trace how they work together in a single cycle.

知道了组件之后，我们跟一遍它们在一次循环里是怎么协作的。

![7 步循环流程：从 Prompt Assembly 到 Loop Back](https://img.riba2534.cn/images/2026/04/tweet_4.jpg)

**Step 1 (Prompt Assembly)** : The harness constructs the full input: system prompt + tool schemas + memory files + conversation history + current user message. Important context is positioned at the beginning and end of the prompt (the "Lost in the Middle" finding).

**第 1 步（Prompt 组装）** ：harness 构造完整输入——system prompt + 工具 schema + 记忆文件 + 对话历史 + 当前用户消息。重要内容放在 prompt 的开头和结尾（「Lost in the Middle」的发现）。

**Step 2 (LLM Inference)** : The assembled prompt goes to the model API. The model generates output tokens: text, tool call requests, or both.

**第 2 步（LLM 推理）** ：组装好的 prompt 发给模型 API。模型生成输出 token：文本、工具调用请求，或两者兼有。

**Step 3 (Output Classification)** : If the model produced text with no tool calls, the loop ends. If it requested tool calls, proceed to execution. If a handoff was requested, update the current agent and restart.

**第 3 步（输出分类）** ：如果模型只生成了文本、没有工具调用，循环结束。如果请求了工具调用，进入执行阶段。如果请求了 handoff，更新当前 agent 并重启循环。

**Step 4 (Tool Execution)** : For each tool call, the harness validates arguments, checks permissions, executes in a sandboxed environment, and captures results. **Read-only operations can run concurrently; mutating operations run serially.**

**第 4 步（工具执行）** ：对每个工具调用，harness 校验参数、检查权限、在沙箱里执行、抓取结果。 **只读操作可以并发执行；写操作串行执行。**

**Step 5 (Result Packaging)** : Tool results are formatted as LLM-readable messages. Errors are caught and returned as error results so the model can self-correct.

**第 5 步（结果打包）** ：工具结果被格式化成 LLM 能读懂的消息。错误会被捕获并作为 error result 返回，让模型自行纠正。

**Step 6 (Context Update)** : Results are appended to conversation history. If approaching the context window limit, the harness triggers compaction.

**第 6 步（上下文更新）** ：结果被追加到对话历史。如果接近上下文窗口上限，harness 触发压缩。

**Step 7 (Loop)** : Return to Step 1. Repeat until termination.

**第 7 步（循环）** ：回到第 1 步，直到终止。

Termination conditions are layered: the model produces a response with no tool calls, maximum turn limit is exceeded, token budget is exhausted, a guardrail tripwire fires, the user interrupts, or a safety refusal is returned. A simple question might take 1 to 2 turns. A complex refactoring task can chain dozens of tool calls across many turns.

终止条件是分层的：模型生成一条没有工具调用的响应、达到最大轮数、token 预算耗尽、护栏 tripwire 被触发、用户中断、或者返回安全拒绝。一个简单问题可能只需要 1 到 2 轮。一个复杂的重构任务可能横跨许多轮、串起几十次工具调用。

For long-running tasks spanning multiple context windows, Anthropic developed a two-phase "Ralph Loop" pattern: an Initializer Agent sets up the environment (init script, progress file, feature list, initial git commit), then a Coding Agent in every subsequent session reads git logs and progress files to orient itself, picks the highest-priority incomplete feature, works on it, commits, and writes summaries. **The filesystem provides continuity across context windows.**

对于跨越多个上下文窗口的长任务，Anthropic 设计了一个两阶段的「Ralph Loop」模式：Initializer Agent 先搭好环境（init 脚本、进度文件、特性列表、初始 git commit），之后每一次会话里的 Coding Agent 都通过读取 git log 和进度文件来自我定位，挑出最高优先级的未完成特性，动手、提交、写总结。 **文件系统充当了跨上下文窗口的连续性载体。**

## How Real Frameworks Implement the Pattern

## 真实框架是怎么实现这套模式的

![五大框架对比：Claude Agent SDK / OpenAI Agents SDK / LangGraph / CrewAI / AutoGen](https://img.riba2534.cn/images/2026/04/tweet_5.jpg)

**Anthropic's Claude Agent SDK** exposes the harness through a single `query()` function that creates the agentic loop and returns an async iterator streaming messages. The runtime is a "dumb loop." All intelligence lives in the model. Claude Code uses a **Gather-Act-Verify cycle** : gather context (search files, read code), take action (edit files, run commands), verify results (run tests, check output), repeat.

**Anthropic 的 Claude Agent SDK** 通过一个 `query()` 函数暴露 harness，它创建 agent 循环并返回一个流式推送消息的异步迭代器。runtime 是一个「dumb loop」，所有智能都在模型里。Claude Code 使用的是 **Gather-Act-Verify 循环** ：收集上下文（搜文件、读代码）→ 采取行动（改文件、跑命令）→ 验证结果（跑测试、看输出）→ 重复。

**OpenAI's Agents SDK** implements the harness through the Runner class with three modes: async, sync, and streamed. The SDK is "code-first": workflow logic is expressed in native Python rather than graph DSLs. The Codex harness extends this with a three-layer architecture: **Codex Core** (agent code + runtime), **App Server** (bidirectional JSON-RPC API), and **client surfaces** (CLI, VS Code, web app). All surfaces share the same harness, which is why "Codex models feel better on Codex surfaces than a generic chat window."

**OpenAI 的 Agents SDK** 通过 Runner 类实现 harness，提供三种模式：async、sync、streamed。这个 SDK 是「code-first」的——工作流逻辑用原生 Python 表达，而不是图 DSL。Codex harness 在此基础上扩展成三层架构： **Codex Core** （agent 代码 + runtime）、 **App Server** （双向 JSON-RPC API）、 **client 层** （CLI、VS Code、web app）。所有客户端共享同一个 harness，这也是为什么「Codex 模型在 Codex 客户端上的体感比在通用聊天窗口里更好」。

**LangGraph** models the harness as an explicit state graph. Two nodes (llm_call and tool_node) connected by a conditional edge: if tool calls present, route to tool_node; if absent, route to END. LangGraph evolved from LangChain's AgentExecutor, which was deprecated in v0.2 because it was hard to extend and lacked multi-agent support. LangChain's Deep Agents explicitly use the term "agent harness": built-in tools, planning (write_todos tool), file systems for context management, subagent spawning, and persistent memory.

**LangGraph** 把 harness 建模成一张显式的状态图。两个节点（llm_call 和 tool_node）之间用一条条件边连接：有工具调用就走 tool_node，没有就走 END。LangGraph 是从 LangChain 的 AgentExecutor 演化来的——后者在 v0.2 被废弃，原因是难扩展且不支持多 agent。LangChain 的 Deep Agents 明确使用「agent harness」这个术语：内置工具、规划（write_todos 工具）、用于上下文管理的文件系统、subagent 派生、持久化记忆。

**CrewAI** implements a role-based multi-agent architecture: Agent (the harness around the LLM, defined by role, goal, backstory, and tools), Task (the unit of work), and Crew (the collection of agents). CrewAI's Flows layer adds a "deterministic backbone with intelligence where it matters," managing routing and validation while Crews handle autonomous collaboration.

**CrewAI** 采用的是基于角色的多 agent 架构：Agent（LLM 外面的 harness，由 role、goal、backstory 和 tools 定义）、Task（工作单位）、Crew（agent 集合）。CrewAI 的 Flows 层在此之上加了一条「确定性骨干 + 局部智能」：Flows 负责路由和验证，Crew 负责自治协作。

**AutoGen** (evolving into Microsoft Agent Framework) pioneered conversation-driven orchestration. Its three-layer architecture (Core, AgentChat, Extensions) supports five orchestration patterns: sequential, concurrent (fan-out/fan-in), group chat, handoff, and magentic (a manager agent maintains a dynamic task ledger coordinating specialists).

**AutoGen** （正在演化为 Microsoft Agent Framework）首创了「对话驱动」的编排方式。它的三层架构（Core、AgentChat、Extensions）支持五种编排模式：顺序、并发（fan-out/fan-in）、群聊、handoff、magentic（一个 manager agent 维护一份动态任务 ledger 来协调各专家）。

## The Scaffolding Metaphor

## 脚手架的隐喻

The scaffolding metaphor isn't decorative. It's precise. Construction scaffolding is temporary infrastructure that enables workers to build a structure they couldn't reach otherwise. **It doesn't do the construction. But without it, workers can't reach the upper floors.**

脚手架这个比喻不是装饰。它很精确。工地上的脚手架是一种临时基础设施，让工人能够搭建他们原本够不着的结构。 **它不参与建造本身，但没有它，工人爬不上高楼。**

![脚手架隐喻：LLM 在干活，harness 是让他够得着楼层的临时结构](https://img.riba2534.cn/images/2026/04/tweet_6.jpg)

The key insight: **scaffolding is removed when the building is complete. As models improve, harness complexity should decrease.** Manus was rebuilt five times in six months, each rewrite removing complexity. Complex tool definitions became general shell execution. "Management agents" became simple structured handoffs.

关键洞察是： **大楼盖好，脚手架就拆了。随着模型变强，harness 的复杂度应该下降。** Manus 在六个月里重写了五次，每一次都在去掉复杂度。复杂的工具定义变成了通用 shell 执行，「管理 agent」变成了简单的结构化 handoff。

This points to the co-evolution principle: **models are now post-trained with specific harnesses in the loop.** Claude Code's model learned to use the specific harness it was trained with. Changing tool implementations can degrade performance because of this tight coupling.

这揭示了一条共同演化原则： **模型现在是和特定的 harness 一起做 post-train 的。** Claude Code 的模型是和它那套特定的 harness 一起学出来的。更换工具实现反而可能导致性能下降——因为这层耦合非常紧。

The "future-proofing test" for harness design: **if performance scales up with more powerful models without adding harness complexity, the design is sound.**

harness 设计的「面向未来测试」是： **换上更强的模型，不需要增加 harness 复杂度，性能就自动上来了——那你的设计就是对的。**

## Seven Decisions That Define Every Harness

## 定义每个 Harness 的七个关键决策

Every harness architect faces seven choices:

每个 harness 架构师都要面对七个选择：

![Agent Harness 设计空间：七条决策分支](https://img.riba2534.cn/images/2026/04/tweet_8.jpg)

**1. Single-agent vs. multi-agent.** Both Anthropic and OpenAI say: maximize a single agent first. Multi-agent systems add overhead (extra LLM calls for routing, context loss during handoffs). Split only when tool overload exceeds ~10 overlapping tools or clearly separate task domains exist.

**1. 单 agent vs. 多 agent。** Anthropic 和 OpenAI 都给出同一个建议：先把单 agent 的能力榨到极致。多 agent 系统会引入额外开销（路由的额外 LLM 调用、handoff 过程中的上下文损失）。只有当工具数超过 ~10 个且互相重叠，或者任务域明显可分时，才考虑拆分。

**2. ReAct vs. plan-and-execute.** ReAct interleaves reasoning and action at every step (flexible but higher per-step cost). Plan-and-execute separates planning from execution. **LLMCompiler reports a 3.6x speedup over sequential ReAct.**

**2. ReAct vs. plan-and-execute。** ReAct 在每一步都把推理和行动交织起来（灵活但每步成本更高）。plan-and-execute 把规划和执行拆开。 **LLMCompiler 报告相比顺序 ReAct 提速 3.6 倍。**

**3. Context window management strategy.** Five production approaches: time-based clearing, conversation summarization, observation masking, structured note-taking, and sub-agent delegation. **ACON research showed 26 to 54% token reduction while preserving 95%+ accuracy** by prioritizing reasoning traces over raw tool outputs.

**3. 上下文窗口管理策略。** 生产级常见的五种方法：基于时间的清理、对话摘要、observation 屏蔽、结构化笔记、子 agent 委派。 **ACON 的研究表明：优先保留推理轨迹、丢掉原始工具输出，能减少 26% 到 54% 的 token，同时保持 95% 以上的准确率。**

**4. Verification loop design.** Computational verification (tests, linters) provides deterministic ground truth. Inferential verification (LLM-as-judge) catches semantic issues but adds latency. Martin Fowler's Thoughtworks team frames this as guides (feedforward, steer before action) versus sensors (feedback, observe after action).

**4. 验证循环设计。** 计算型验证（测试、linter）提供确定性的 ground truth。推断型验证（LLM-as-judge）能捕获语义问题但引入延迟。Martin Fowler 在 Thoughtworks 团队把这件事总结成 guides（前馈，行动前引导）和 sensors（反馈，行动后观察）两类。

**5. Permission and safety architecture.** Permissive (fast but risky, auto-approve most actions) versus restrictive (safe but slow, require approval for each action). The choice depends on deployment context.

**5. 权限与安全架构。** 宽松型（快但有风险，大多数操作自动通过）vs. 严格型（安全但慢，每个操作都要批准）。怎么选，取决于部署场景。

**6. Tool scoping strategy.** More tools often means worse performance. **Vercel removed 80% of tools from v0 and got better results.** Claude Code achieves 95% context reduction via lazy loading. The principle: expose the minimum tool set needed for the current step.

**6. 工具边界策略。** 工具越多往往表现越差。 **Vercel 从 v0 里砍掉了 80% 的工具，反而跑出了更好的结果。** Claude Code 通过懒加载做到 95% 的上下文缩减。原则是：只暴露当前这一步真正需要的最小工具集。

**7. Harness thickness.** How much logic lives in the harness versus the model. **Anthropic bets on thin harnesses and model improvement.** Graph-based frameworks bet on explicit control. Anthropic regularly deletes planning steps from Claude Code's harness as new model versions internalize that capability.

**7. Harness 厚度。** 有多少逻辑放在 harness 里，有多少放在模型里。 **Anthropic 押注薄 harness 加模型进化。** 基于图的框架则押注显式控制。Anthropic 每次新模型把规划能力内化之后，都会从 Claude Code 的 harness 里删掉对应的规划步骤。

![Thin vs. Thick Harness：是相信模型，还是把逻辑写死在代码里](https://img.riba2534.cn/images/2026/04/tweet_7.jpg)

## The Harness Is the Product

## Harness 就是产品本身

Two products using identical models can have wildly different performance based solely on harness design. **The TerminalBench evidence is clear: changing only the harness moved agents by 20+ ranking positions.**

两个用同一个模型的产品，只因为 harness 设计不同，表现可以天差地别。 **TerminalBench 的证据很清楚：只改 harness，agent 的排名能移动 20 位以上。**

The harness is not a solved problem or a commodity layer. It's where the hard engineering lives: **managing context as a scarce resource, designing verification loops that catch failures before they compound, building memory systems that provide continuity without hallucination, and making architectural bets about how much scaffolding to build versus how much to leave to the model.**

harness 既不是一个已解决的问题，也不是一层商品化组件。这里才是硬核工程的所在： **把上下文当作稀缺资源来管理、设计能在错误复合之前抓住它们的验证循环、构建既能提供连续性又不产生幻觉的记忆系统、在「自己搭多少脚手架 vs. 交给模型多少」之间下架构级的赌注。**

The field is moving toward thinner harnesses as models improve. But the harness itself isn't going away. Even the most capable model needs something to manage its context window, execute its tool calls, persist its state, and verify its work.

随着模型进步，整个领域正在走向更薄的 harness。但 harness 本身不会消失。就算是最强的模型，也仍然需要一层东西来管理它的上下文窗口、执行它的工具调用、持久化它的状态、验证它的工作。

**The next time your agent fails, don't blame the model. Look at the harness.**

**下次你的 agent 出毛病时，别怪模型，去看看 harness。**
