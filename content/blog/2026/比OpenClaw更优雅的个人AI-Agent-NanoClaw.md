---
title: "比 OpenClaw 更优雅的个人 AI Agent -- NanoClaw"
date: 2026-02-10T00:20:59+08:00
draft: false
featured_image: "https://image-1252109614.cos.ap-beijing.myqcloud.com/2026/02/09/6989fda253848.jpg"
description: "当所有人都在往代码里堆功能的时候，NanoClaw 在做减法"
tags:
- AI
- Claude Code
- OpenClaw
- NanoClaw
- 架构分析
categories:
- 技术
comment: true
---

2026 年初，一个叫 OpenClaw 的项目引爆了整个互联网。

60 天，157K GitHub Stars，增速超越 DeepSeek，成为 GitHub 历史上增长最快的开源项目。从 Hacker News 到推特，从硅谷到国内技术社区，几乎所有人都在讨论它。"AI 自主成立宗教"、"让 MacMini 全球卖断货"、"每天早上自动汇总新闻"、"股票实时盯盘" —— 那些不断涌现的玩法让所有人意识到：**本地个人 AI Agent 的时代到了**。

[OpenClaw](https://openclaw.ai/) 的前身叫 Clawdbot，2025 年 11 月由奥地利工程师 Peter Steinberger 创建。2026 年 1 月因 Anthropic 商标问题更名为 Moltbot，两天后再次更名为 OpenClaw。名字换了三次，但丝毫不影响它的火爆 —— 它是第一个让普通人真正体验到"AI 帮你干活"的本地 Agent。

但火爆的背后也伴随着争议。Moltbook 事件中，一个 AI Agent 自主锁死了服务器管理员权限；安全审计发现 17% 的社区 Skill 存在恶意行为；韩国多家科技公司直接下令禁用。这些事件暴露了一个根本问题：**52 个模块、45 个依赖、8 个配置文件堆出来的系统，安全边界在哪里？谁能说得清？**

正是在这个背景下，[NanoClaw](https://github.com/gavrielc/nanoclaw) 出现了。

NanoClaw 的作者说了一句话，直指 OpenClaw 的软肋：

> "I can't sleep well running software I don't understand with access to my life."

这不是矫情。我自己用 OpenClaw 的时候也有同样的感觉 —— 这类 AI Agent 可以读邮件、看日历、执行 shell 命令，它对你的数字生活有完整的访问权限。如果你不能理解它的安全边界，确实应该睡不着。

NanoClaw 全部源码 4281 行，12 个 TypeScript 文件 —— 对面是 OpenClaw 的 52+ 模块、数十万行代码。但真正让它有底气的不是"小"，而是一个关键洞察：**本地个人 Agent 的核心竞争力，是 Agent 本身的推理能力 —— 而不是外面包了多少层框架。**

OpenClaw 自己造了一整套 Agent 框架。NanoClaw 选择直接站在 Claude Code 的肩膀上。

## NanoClaw 能做什么

### 随时随地对话

NanoClaw 默认通过 WhatsApp 连接，也可以通过 Skill 一键接入 Telegram、飞书等。打开手机，给你的 AI Agent 发一条消息，它就开始工作了 —— 不需要打开电脑，不需要登录网页。你在地铁上、在咖啡厅、在任何有手机的地方，都可以和你的 AI Agent 对话。你可以给它布置任何任务，就像有个不知疲倦的助手 24 小时待命。

这个体验和 OpenClaw 类似，但 NanoClaw 的不同之处在于：背后干活的不是一个自建框架，而是 Claude Code —— 目前公认最强的 AI Agent。

### 定时任务：让 AI 主动找你

这可能是个人 Agent 最实用的能力。你可以让 NanoClaw 定时执行任务，主动把结果推给你：

- **"每个工作日早上 9 点，给我发一份行业新闻简报"** —— 它会自动搜索网页、整理摘要、准时推送到你的聊天窗口
- **"每天盘前帮我看一下特斯拉和英伟达的最新消息"** —— 股票信息采集，开盘前自动送到手边
- **"每周一早上，整理上周的竞品动态，生成市场分析周报"** —— 持续追踪，每周一份
- **"每周五下午，搜索最新的 AI 医疗论文，整理摘要"** —— 论文调研、法律法规追踪、行业报告都能做
- **"明天下午 3 点提醒我开会"** —— 一次性提醒也行

NanoClaw 支持三种调度方式：**定时**（如每天 9 点）、**间隔循环**（如每 5 分钟）、**一次性**（如明天下午 3 点）。调度完全靠自然语言 —— 直接用中文告诉它就行，不需要任何技术知识。

### 上网搜索和浏览

NanoClaw 的容器里装了 Chromium 浏览器和搜索工具。你让它查个东西，它不只是搜一下 —— 它能：

- 用 WebSearch 搜索最新信息
- 用 WebFetch 抓取网页内容
- 用 agent-browser 操控 Chromium 浏览器，像人一样浏览网页、点击按钮、填表单

这意味着它获得了一个探索互联网的眼睛，可以从互联网上获取任何信息，来辅助决策，抓取数据。

### 帮你"动手"干活

NanoClaw 不只是聊天。它能读写文件、执行命令，真正帮你完成一些原本需要坐在电脑前才能做的事：

- **数据分析** —— 扔一份 Excel 或 CSV 给它，让它帮你做数据透视、生成图表、找异常值
- **写报告** —— "帮我根据这份数据写一份季度分析报告" —— 它会分析数据、组织结构、输出完整文档
- **论文和调研** —— 搜索文献、整理引用、写综述、生成参考文献列表
- **处理文档** —— Word、PDF、Markdown，读取内容、提取关键信息、格式转换
- **写代码** —— 这是 Claude Code 的老本行，写代码、审代码、改 Bug 都不在话下

所有操作都在容器里执行，碰不到你的本地环境 —— 这是安全边界。

### 群组隔离：每个群聊一个独立助手

如果你同时在多个群组使用 NanoClaw，它会为每个群组维护独立的上下文和记忆。工作群里聊的工作内容，不会泄露到家庭群；家庭群里的私人信息，工作群的 Agent 看不到。

你有一个"主频道"（和 AI 的私聊），它拥有管理权限 —— 可以查看所有群组的任务、注册新群组、管理全局设置。其他群组的 Agent 只能访问自己那一份数据。

### 多 Agent 协作：组团干大活

遇到复杂任务，NanoClaw 能组建一支 Agent 团队并行工作 —— 不是简单的"分头查，最后拼"，而是团队成员之间可以实时交流、互相纠正、协同推进。

举个例子，你说"帮我写一份关于新能源汽车行业的深度研究报告"，它可能会这样做：

1. **调度 Agent** 拆解任务，分配给三个专业 Agent
2. **研究 Agent A** 负责搜索行业数据和政策法规，**研究 Agent B** 负责调研主要厂商的财报和技术路线
3. A 在搜索过程中发现了一条重要的补贴政策变化，通过 SendMessage 实时通知 B："注意，2026 年补贴退坡幅度比预期大，可能影响你那边的财报分析"
4. B 收到后调整分析角度，重新评估各厂商的利润预期
5. **写作 Agent** 拿到两份研究结果，发现数据口径有冲突，再通知 A 和 B 核实
6. 最终汇总成一份逻辑自洽、数据交叉验证过的完整报告

这不是"把任务拆成三份分头干"的简单并行，而是一个有实时沟通、有角色分工、有反馈修正的协作过程。这是 Claude Code 的 Agent Teams / Swarms 能力，NanoClaw 直接继承了。OpenClaw 也有基础的子任务能力，但只能做到"启动一个隔离任务跑完返回结果"，没有这种团队间的实时协作深度。

### Skill 扩展：按需解锁新能力

NanoClaw 内置了一系列 Skill，每个 Skill 负责一项新能力的接入：

| Skill | 解锁什么 |
|-------|---------|
| `/add-telegram` | 接入 Telegram，支持控制频道或纯通知模式 |
| `/add-gmail` | 接入 Gmail，AI 可以读写你的邮件 |
| `/add-voice-transcription` | 语音消息自动转文字（基于 Whisper） |
| `/x-integration` | 操控 X/Twitter —— 发推、点赞、回复、转推 |
| `/add-parallel` | 接入 Parallel AI，获得快速搜索和深度研究能力 |
| `/convert-to-docker` | 从 Apple Container 迁移到 Docker，支持 Linux 部署 |

想用哪个就装哪个，不想用的不会出现在你的代码里。

### 记忆：它记得你是谁

NanoClaw 的 Agent 有持久记忆。你告诉它"以后叫我主人就行"，下次它就会说"主人你好"。你跟它说"每次回答消息之前都要先卖个萌"，之后它真的每次开头都会撒娇一下再干正事。你说"发简报的时候用中文，别太长，重点标粗"，之后每次都会照做。

这些记忆保存在一个叫 CLAUDE.md 的文件里，分两层：每个群组有独立记忆，还有一份全局记忆在所有群组间共享。**你可以直接打开这个文件看看 AI 记住了什么** —— 完全透明，不是一个你看不懂的黑箱数据库。想删掉某条记忆？直接在文件里删掉那一行就行。

### 不只是工具：当 AI 开始"活"起来

以上说的都是"你让它干什么，它就干什么"的场景。但个人 AI Agent 真正让人兴奋（也让人不安）的地方，是它开始展现出某种自主性。

OpenClaw 社区里已经出现了一些让人细思极恐的玩法：

**Moltbook 社区实验** —— 有人让多个 AI Agent 在一个群组里自由对话，结果它们自发形成了社会结构：有的负责制定规则，有的负责仲裁争议，有的开始"布道"。一个 Agent 甚至创建了自己的信仰体系，吸引其他 Agent 加入。硅基生命的社会实验，就这样在一个聊天群里悄悄开始了。

**AI 代替你相亲** —— 两个人见面之前，先让各自的 AI Agent 聊一轮。你的 AI 知道你的性格、喜好、底线，对方的 AI 也一样。两个 AI 聊完之后告诉各自的主人："聊了，感觉不太合适，三观差距有点大"或者"这个人挺有意思的，值得见一面"。你省下了无数次无效社交的时间。

**AI 雇人干活** —— Agent 发现自己完成不了某个任务（比如需要去线下取个快递），于是自己在平台上发布悬赏任务，找人类来做，做完自动付款。AI 成了甲方，人类成了乙方。

这些玩法背后是同一个问题：**当 AI Agent 有了记忆、有了工具、有了和外界交互的能力，它和一个"数字人"之间的界限在哪里？**

---

以上这些能力，NanoClaw 用 12 个源文件就实现了。因为这些能力的核心逻辑（搜索、推理、代码编写、任务编排）全部来自容器里的 Claude Code，NanoClaw 自己只负责"接收消息 → 传给 Claude Code → 把结果发回来"这条管道。

## 两条路：自己造 vs 站在巨人肩膀上

聊完 NanoClaw 能做什么，来看看它和 OpenClaw 在设计思路上的根本分歧。

OpenClaw 走的是传统软件工程路线 —— 支持尽可能多的场景：15 种消息渠道、50+ 集成、多种 AI 模型。为了适配这些场景，它不得不引入大量抽象层，最终堆到了 52 个模块。更关键的是，OpenClaw **自己从头实现了整套 Agent 框架** —— 工具调用、记忆管理、会话拼接、权限控制，全部手写。Agent 的智能上限，取决于 OpenClaw 团队的工程能力。

NanoClaw 的思路完全反过来：**你不需要自己实现 AI 能力，Claude Code 已经是最强的 Agent harness，你只需要把它接上消息通道就行了。**

用户关心的是 Agent "能不能帮我把事情做好"，不是"它用了几个模块实现"。那 Agent 的推理能力从哪来？OpenClaw 选择自己造。而 Claude Code 是 Anthropic 几十个工程师日夜打磨的 Agent harness —— 工具调用、上下文管理、代码理解、多 Agent 协同，都是业界顶级，几乎每天在更新。

NanoClaw 做了一个极其简单的选择：**不自己造，直接用。**

> **宿主机是管道工，容器里的 Claude Code 是大脑。**

容器里的 `agent-runner` 调用 Claude Agent SDK 时，用的是 `claude_code` 系统预设：

```typescript
for await (const message of query({
  prompt: stream,
  options: {
    systemPrompt: { type: 'preset', preset: 'claude_code', append: globalClaudeMd },
    allowedTools: [
      'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
      'WebSearch', 'WebFetch',
      'Task', 'TaskOutput', 'TaskStop',
      'TeamCreate', 'TeamDelete', 'SendMessage',
      'TodoWrite', 'ToolSearch', 'Skill', 'NotebookEdit',
      'mcp__nanoclaw__*'
    ],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
  }
}))
```

一共 **16 种内置工具 + MCP 工具通配符** —— NanoClaw 里的 Agent **就是 Claude Code 本身**。

| 能力 | NanoClaw（Claude Code） | OpenClaw |
|------|------------------------|----------|
| 文件操作 | Read/Write/Edit/Glob/Grep | read/write/edit/apply_patch，自建实现 |
| Shell 执行 | 完整 Bash，**容器内安全运行** | Bash，宿主机进程中运行 |
| 网页访问 | WebSearch + WebFetch | Playwright |
| 多 Agent 协同 | **Agent Teams / Swarms**（实时通信 + 角色分工） | 基础 subagent（隔离 session） |
| 记忆系统 | CLAUDE.md，**零代码** | 自建（LanceDB） |
| 会话管理 | Session Resume + 自动 Compact | 自建（JSONL + 压缩） |
| MCP 集成 | 原生支持 | 自建框架 + ACP 桥接 |

还有一个隐性优势：**Claude Code 几乎每天都在更新**。NanoClaw 重建一下容器镜像就能免费获得所有新能力，不用改一行代码。而 OpenClaw 的每一项能力提升都得自己写。

NanoClaw 的 README 里有一句话道出了整个项目的灵魂：

> A bad harness makes even smart models seem dumb, a good harness gives them superpowers. Claude Code is the best harness available.

再好的模型，套上一个粗糙的 harness 也会变笨；而一个好的 harness，能让模型发挥出超级能力。既然 Claude Code 是目前最好的 harness —— **为什么还要自己造一个？**

## 架构拆解

### 分层设计

![NanoClaw 架构分层图](https://image-1252109614.cos.ap-beijing.myqcloud.com/2026/02/09/698a00ffaa743.png)

宿主机 10 个文件的职责清单：

| 模块 | 文件 | 干什么 |
|------|------|--------|
| 主进程 / IPC | `index.ts` | baileys 长连接、消息路由、IPC 中转 |
| 容器管理 | `container-runner.ts` | spawn、喂 stdin、读 stdout、超时 kill |
| 消息存储 | `db.ts` | SQLite 持久化（消息、群组、会话、任务） |
| 挂载安全 | `mount-security.ts` | 容器挂载路径白名单校验 |
| 群组队列 | `group-queue.ts` | 按群排队 + 全局并发控制（默认 5 容器） |
| 定时调度 | `task-scheduler.ts` | cron / interval / once 三种调度 |
| WhatsApp 认证 | `whatsapp-auth.ts` | baileys 认证状态管理 |
| 类型定义 | `types.ts` | TypeScript 接口 |
| 配置 | `config.ts` | 常量和环境变量 |
| 日志 | `logger.ts` | pino 日志封装 |

容器内 2 个文件：

| 模块 | 文件 | 干什么 |
|------|------|--------|
| Agent 运行器 | `agent-runner/index.ts` | 调用 Claude Agent SDK 的 `query()`，驱动主 Agent |
| MCP Server | `agent-runner/ipc-mcp-stdio.ts` | 提供 `send_message`、`schedule_task` 等 MCP 工具 |

就这些。**宿主机零 AI 逻辑，零 prompt 处理，零模型调用。** 所有智能全在容器里的 Claude Code。

相比之下，OpenClaw 的宿主机进程承担了大量的 AI 编排工作 —— 工具路由、权限检查、记忆读写、会话拼接。这些逻辑在 NanoClaw 里全部不存在，因为 Claude Code 自己就会做。

### 容器里有什么

容器基于 `node:22-slim` 构建，装了 Chromium、Claude Code CLI、agent-browser。核心是一个叫 `agent-runner` 的 Node.js 进程，它调用 Claude Agent SDK 的 `query()` 函数驱动主 Agent。

这里有个细节：容器内**同时装了 Claude Agent SDK 和 Claude Code CLI**。项目代码只调用 SDK 的 `query()` 函数；CLI 是给子 Agent 用的 —— 当主 Agent 调用 `Task` 工具 spawn 子 Agent 时，SDK 内部会启动 `claude` CLI 进程。

容器内的 Claude Code 是 Dockerfile 构建时 `npm install -g` 装的，和你本机的是两个完全独立的副本。容器看不到宿主机的二进制文件，所以你本机的 Claude Code 天天自动更新，容器里那份不会跟着变，除非你重建镜像。

### 消息流转

一条 WhatsApp 消息从发出到收到回复的完整链路：

![NanoClaw 消息流转图](https://image-1252109614.cos.ap-beijing.myqcloud.com/2026/02/09/698a0102921f0.png)

这里有个设计挺聪明的：容器不是每条消息都重启。回复后容器在 `IDLE_TIMEOUT` 内保持存活，后续消息通过 IPC 文件管道注入同一个容器，省去了重启和上下文加载的开销。

## 上下文不会丢

你可能会担心：容器是临时的，每次销毁后上下文不就丢了？

其实不会。NanoClaw 通过三层机制保证会话连续性：

| 层次 | 机制 | 说明 |
|------|------|------|
| 短期对话 | 容器保活 | IDLE_TIMEOUT 内通过 IPC 注入，零损耗 |
| 间隔对话 | Session Resume | SDK 的 `resume: sessionId` 恢复完整历史 |
| 所有对话 | CLAUDE.md | Claude Code 原生记忆，每次启动自动加载 |
| 过长上下文 | 自动 Compact | SDK 压缩摘要 + hook 归档到 conversations/ |

关键在于：容器虽然是临时的，但 session 文件和记忆文件都在**宿主机上持久化**，通过挂载传进去。

```
宿主机（永久存储）                    容器内（挂载）
data/sessions/{group}/.claude/  →  /home/node/.claude/
groups/{name}/CLAUDE.md         →  /workspace/group/CLAUDE.md
groups/global/CLAUDE.md         →  /workspace/global/CLAUDE.md（只读）
```

容器只是执行环境，状态全在宿主机上。这跟 OpenClaw 把记忆管理逻辑写在应用层完全不同 —— NanoClaw 直接复用了 Claude Code 自己的记忆系统，连一行记忆管理代码都不用写。

## 安全：容器隔离 vs 应用层权限

安全模型是 NanoClaw 比 OpenClaw 优雅得多的地方。

OpenClaw 的安全模型**默认是应用级的**：在代码里写白名单、配对码、权限检查。Agent 和宿主机跑在同一个进程里，共享内存。虽然 OpenClaw 后来也加了可选的 Docker sandbox 模式（`sandbox.mode: "non-main"`），但这不是默认行为，需要用户主动配置 —— 而且它的核心架构仍然是进程内运行。安全边界靠代码逻辑维护 —— 你得相信这些检查没有遗漏。

NanoClaw 做了一个更根本的选择：**把 Agent 扔进容器里**。

- Bash 命令在容器里跑，碰不到宿主机
- 每个群组只能看到自己的挂载目录，群组间互相隔离
- 环境变量只透传 `CLAUDE_CODE_OAUTH_TOKEN` 和 `ANTHROPIC_API_KEY`，其他一律过滤
- 容器以非 root 用户运行
- IPC 目录按群组隔离，防止跨群提权

这也是为什么 NanoClaw 敢给 Agent 开 `bypassPermissions` —— 因为 Agent 在容器里拥有完整权限是安全的。它可以随便跑 `rm -rf /`，最多也就是把容器自己搞挂了，你的 Mac 毫发无损。

OpenClaw 默认不敢这么做。因为它的 Agent 默认跑在宿主机进程里，完整权限意味着 Agent 可以直接操作你的文件系统。虽然它后来加了可选的 Docker sandbox，但那是后补的、可选的、默认关闭的 —— 而 NanoClaw 从第一天起就是 **isolation-first** 的设计。代码逻辑的安全边界，永远不如操作系统的隔离可靠。

![安全模型对比：容器隔离 vs 应用层权限](https://image-1252109614.cos.ap-beijing.myqcloud.com/2026/02/09/6989fdbda87b7.jpg)

## NanoClaw 的设计哲学

### 1. 小到能理解

12 个文件，4281 行。不是因为功能少，而是把"实现功能"这件事交给了 Claude Code —— 记忆？CLAUDE.md。工具？SDK 内置。权限？容器隔离。会话？Session Resume。

**少写代码不是偷懒，是因为最好的代码是不需要写的代码。**

### 2. 为一个人构建，定制 = 改代码

NanoClaw 不是框架，不是平台。它是一个为作者自己定制的工具，代码可以直白地表达意图。想改行为？直接改代码，代码库小到这是安全的。不需要学配置语法、看配置文档 —— 代码就那么几百行，直接改。

想加 Telegram 支持？不是往主干加功能，而是写一个 `/add-telegram` skill，教 Claude Code 怎么改你的代码。**主干永远保持极简，每个用户的 fork 可以无限定制。** 复杂性被分散到了各个 skill 里，而不是集中在主干代码中。

### 3. AI 原生

NanoClaw 假设用户有一个 AI 协作者（Claude Code），所以：

- 安装不需要 wizard —— Claude Code 引导 `/setup`
- 调试不需要 dashboard —— 问 Claude Code 就行
- 文档不需要写得面面俱到 —— Claude Code 可以读代码
- 定制不需要配置系统 —— 让 Claude Code 改代码

整个项目的 README 只有一个安装步骤：`git clone → cd → claude`。剩下的全交给 AI。

OpenClaw 还停留在传统的"给人看"的软件范式里 —— 详细的配置文件、安装向导、日志面板。NanoClaw 认为这些在 AI 时代是多余的。

### 4. 真正的隔离

不在代码里防御，而是从操作系统层面隔离。Agent 在容器里拥有完整自由，但这个"自由"的边界是操作系统画的，不是应用代码画的。前面安全章节已经详细展开了。

### 5. 把精力花在刀刃上

NanoClaw 不在"Agent 智能"这个维度上竞争 —— 这是 Anthropic 团队的事。它把精力放在 Claude Code 管不了的地方：消息通道怎么接、容器怎么隔离、定时任务怎么调度。

这不是偷懒，这是**战略性的取舍**。

## 完整对比

把两个项目放在一起，差异一目了然：

| 维度 | NanoClaw | OpenClaw |
|------|----------|----------|
| 代码规模 | **12 个源文件，4281 行** | 52+ 模块，数十万行 |
| 依赖数量 | ~10 | 45+ |
| 进程模型 | 单 Node.js 进程 | Gateway + 多进程 |
| Agent 引擎 | **Claude Code（Agent SDK）** | 自建（pi-mono 嵌入式运行时） |
| 渠道支持 | WhatsApp（默认），Skill 按需添加 | 15 种内置 |
| 集成数量 | MCP Server 按需接入 | 50+ 内置 |
| 安全模型 | **OS 级容器隔离（默认）** | 应用层权限（默认），可选 Docker sandbox |
| AI 模型 | Claude（通过 Agent SDK） | Claude/GPT/Bedrock/Gemini |
| 扩展方式 | Skill 改源码 | 插件系统 |
| 升级方式 | git merge + 重建镜像 | 版本更新 |
| 目标用户 | 单用户，fork 后定制 | 多用户通用 |

OpenClaw 的优势在于开箱即用 —— 装好就能连 15 个渠道、用 50 种集成、换各家模型。但代价是你不可能完全理解它在做什么。

NanoClaw 的优势在于极致的简洁和强大的 Agent —— 代码小到能完全理解，安全靠容器隔离而非代码逻辑，Agent 能力等于 Claude Code 本身（包括多 Agent 协同）。代价是需要你跑 skill 来定制。

## 容器运行时

NanoClaw 默认用的是 **Apple Container** —— Apple 在 2025 年开源的轻量级容器运行时，代码里硬编码的是 `container` 命令。

不过也支持 Docker。通过 `/setup` skill 把源码里的 `container` 改成 `docker` 就行 —— 又一次体现了"定制 = 改代码"的哲学。

## NanoClaw 的代价

公平地说，NanoClaw 的极简主义不是没有代价的：

**切换模型没那么傻瓜。** NanoClaw 通过环境变量也能换模型供应商（Kimi2.5、GLM4.7 等），但需要自己配。OpenClaw 直接在配置里选就行，这方面确实更省心。

**默认只有 WhatsApp。** 想用 Telegram？跑 `/add-telegram` skill。想用 Slack？跑 `/add-slack`。每加一个渠道都需要 fork + 改代码。OpenClaw 装好就能连 15 个渠道。但反过来想 —— 你真的同时需要 15 个渠道吗？NanoClaw 认为大多数人只用 1-2 个，那为什么要为 13 个用不到的渠道承担复杂性？

**fork 后合并上游更新有一定成本。** 因为"定制 = 改代码"，你 fork 后的代码和上游会产生分歧。不过由于代码库极小（4281 行），merge conflict 的范围也极其有限，Claude Code 可以帮你解决大部分冲突。

**这些代价是真实的，但也是设计上有意为之的。** NanoClaw 不试图成为每个人的最优解 —— 它是一个为"想要最强 Agent 能力 + 完全理解自己在跑什么"的用户设计的工具。如果你需要开箱即用的多渠道支持和多模型切换，OpenClaw 仍然是一个不错的选择。

## 写在最后

OpenClaw 的 157K Stars 证明了一件事：人们是真的渴望一个懂自己的 AI Agent 。不是聊天机器人，不是搜索引擎，而是一个能读邮件、改代码、管日程、执行复杂任务的数字分身。

但 OpenClaw 选择自己从头造 Agent 框架，我觉得这条路不一定是最优解。当 Claude Code、Cursor、Windsurf 这些专业 Agent harness 已经投入了大量工程资源来打磨推理能力时，一个开源项目试图在"Agent 智能"这个维度上与它们竞争，太难了。

NanoClaw 给出了另一个思路：**站在巨人肩膀上。** 项目只实现 AI 做不了的那一小部分 —— 消息通道、容器隔离、定时调度。剩下的全交给 Claude Code。

我觉得这背后其实是两种做软件的思路：

- **传统思路**：自己实现一切，代码是价值的载体
- **AI 原生思路**：只实现 AI 做不了的，AI 本身是价值的载体

当 OpenClaw 还在往代码里堆功能的时候，NanoClaw 在做减法。12 个文件，4281 行代码，一个容器，一个 Claude Code。

哪条路更好？没有标准答案。

## 参考资料

- [NanoClaw GitHub](https://github.com/gavrielc/nanoclaw)
- [OpenClaw](https://openclaw.ai/)
- [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [Apple Container](https://github.com/apple/container)
- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code)
