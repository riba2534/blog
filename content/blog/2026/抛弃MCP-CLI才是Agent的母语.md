---
title: "抛弃 MCP, CLI 才是 Agent 的母语"
date: 2026-03-15T17:28:06+08:00
draft: false
featured_image: "https://image-1252109614.cos.ap-beijing.myqcloud.com/2026/03/15/69b67fd0d9d56.jpg"
description: "MCP 试图为 Agent 发明一种新语言，但 Agent 已经会说人话了——Unix CLI 就是那门最自然的语言"
tags:
- AI
- Agent
- MCP
- CLI
categories:
- AI
comment: true
---

Agent 要干活就得调用外部工具——读文件、查数据库、跑命令。目前主流有两条路：一条是 Anthropic 在 2024 年底推出的 MCP（Model Context Protocol），它定义了一套标准化的 JSON-RPC 协议，让 Agent 通过统一的接口跟各种工具对话；另一条是直接用 CLI（Command Line Interface），也就是命令行——`git`、`docker`、`curl` 这些开发者用了几十年的老工具。

今天我好奇做了个统计：过去一个月，Agent 执行的工具调用里，Bash 命令占了 78%，MCP 调用占 12%，剩下 10% 是文件读写。

那 12% 的 MCP 调用里，大部分可以用 CLI 替代。

比如查 GitHub PR，我同时装了 GitHub MCP Server 和 `gh` CLI。用 MCP 查一个 PR 详情，Agent 需要先加载 tool schema、构造 JSON 参数、走 JSON-RPC 协议、解析返回的嵌套 JSON——一个来回消耗几千 tokens。换成 `gh pr view 123`，一行命令，返回人类可读的纯文本，Agent 理解起来零障碍。

两种方式做同一件事，效果一样，成本差一个数量级。

查 PR 只是一个缩影。后来我又对比了几个常用操作：查文件变更用 `git diff` 还是 MCP Git Server？搜代码用 `rg` 还是 MCP Grep Server？管理容器用 `docker` 还是 MCP Docker Server？结论几乎一样——**CLI 更快、更省 token、Agent 用起来更顺。**

这让我开始认真想一个问题：MCP 到底是简化了 Agent 与工具的交互，还是把简单事搞复杂了？

带着这个疑问观察了几个月，我发现不只是我一个人这么想。

## 风向变了

2025 年底到 2026 年初，行业里对 MCP 的态度发生了一次集体转向。

Vercel CEO rauchg 在 X 上直接说："CLIs are the de-facto MCPs for agents"——CLI 就是事实上的 Agent 工具协议。Perplexity CTO、Y Combinator 掌舵人 Garry Tan 也在同一时期公开站了 CLI 这边。中文社区更直接，有人甚至喊出了"MCP 已死"。

从我自己刷 X 的观察来看，MCP 生态的增长在 2026 年 Q1 明显放缓了，而 CLI-first 的 Agent 工具数量在加速增长。我自己的体感也能印证这一点——去年底我还在到处找好用的 MCP Server，现在新出的 Agent 工具很多直接提供 CLI 接口，MCP 反而变成了可选项。

微软的 Playwright 就是典型：先做了 MCP Server，后来又专门出了一个 CLI 版本给 Agent 用（后面会详细讲）。这种"先 MCP 后 CLI"的路径不是个案，Anthropic 自己也走了一遍。

如果只是一两个人吐槽，可以当噪音过滤掉。但当这么多不同背景、不同立场的人在同一时期指向同一个方向，而且工具开发者自己也在用行动投票——**这就是一次结构性的认知转变了。**

用投资的思维看：smart money 集体移动的时候，方向比幅度更重要。

我的判断是：MCP 在 2024-2025 年享受了一波"新协议红利"——新东西出来总会被追捧一阵。但当大量开发者在生产环境中真正用起来之后，问题暴露了。而且这些是设计层面的结构性缺陷，不是修几个 bug 就能解决的。

## 算一笔账——MCP 到底有多贵

"好不好用"是主观判断，但"贵不贵"可以算。

先看一组基础数据。一个标准的 GitHub MCP Server 会话，光是加载工具 schema 就要消耗约 55,000 tokens。Claude 的上下文窗口虽然有 200K tokens，但有效利用率远没有那么高。55K 的 schema 直接占掉超过四分之一的上下文——还没开始干活，空间就去掉了一大块。

社区里有人做了一组更严格的基准测试，直接对比同一批任务在 CLI 和 MCP 下的表现：

| 指标 | CLI | MCP |
|------|-----|-----|
| 单次调用成本 | 基准 | 高 10-32 倍 |
| 任务完成可靠率 | 100% | 72% |
| 初始化开销 | 几乎为零 | schema 加载（数万 tokens） |
| 错误恢复 | 重新执行命令 | 重新建立连接 + 加载 schema |

低 10 到 32 倍——这已经是数量级的差距了。可靠率从 72% 到 100%——用 MCP 跑 10 个任务有 3 个会失败或需要重试，CLI 全部一次通过。

但最让我震动的案例是微软的 Playwright。

微软在 2025 年先做了 Playwright MCP Server，作为浏览器自动化的 Agent 工具接口。功能完整，社区也接受了。然后微软自己用了一段时间，发现了一个没法忽略的问题：**一个 15 步的浏览器自动化会话，MCP 方式要消耗约 114,000 tokens。**

11 万 tokens 做 15 步浏览器操作。

于是微软在 2026 年初推出了 [Playwright CLI](https://github.com/microsoft/playwright-cli)，专门为 Agent 设计。同样的 15 步任务，CLI 方式只需约 27,000 tokens。**同一个团队，同一个产品，token 消耗差了 4 倍以上。**

差距从哪来的？两个地方。

第一是 schema 开销。Playwright MCP Server 有 26 个工具，初始 schema 占约 3,600 tokens。Playwright CLI 的工具描述只有约 68 tokens。3,600 对 68——差了 50 多倍。

第二是状态管理的架构差异。MCP 把浏览器的当前状态（DOM 快照、截图描述、可交互元素列表）内联返回到 Agent 的上下文窗口里。每一步操作都会把完整的页面状态塞进上下文，tokens 消耗滚雪球式增长。CLI 的做法完全不同——它把浏览器状态写到磁盘上的 YAML 文件里，Agent 需要的时候按需读取。状态不常驻上下文空间，用完即弃。

Playwright CLI 的 README 里有一句话：

> Modern coding agents increasingly favor CLI-based workflows over MCP because CLI invocations are more token-efficient.

注意这句话的来源——**这是 Playwright MCP Server 的开发者自己写的。** 他们做了 MCP，发现 CLI 更好，又做了 CLI。这来自内部实践的结论，不是外部批评。

如果只有微软一家这么做，可以说是个案。但 Anthropic 自己也干了同样的事。

Claude Code 早期用 MCP 做代码执行——把代码发给 MCP Server，Server 在沙箱里跑完返回结果。一个中等复杂度的代码执行任务消耗约 150,000 tokens。后来 Anthropic 做了原生的 Code Execution 功能，直接绕开 MCP，同样的任务只需约 2,000 tokens。**从 15 万到 2 千，降了 75 倍。**

MCP 的亲爹绕开了 MCP。这个信号够强了。

用投资的框架看：**当一个产品的单位经济模型不成立时，规模化只会放大亏损。** MCP 的 token 经济学在小规模使用下勉强能接受，但一旦 Agent 开始处理长程任务、多步骤工作流、大量工具调用——成本指数级上升。10 倍的 tokens 意味着 10 倍的 API 费用、10 倍的延迟、10 倍的上下文窗口压力。根基出了问题，不是优化能解决的。

## LLM 的训练数据里，CLI 是母语

Token 经济学回答的是"贵不贵"，但还有一个更根本的问题：**为什么 LLM 用 CLI 就是比用 MCP 顺？**

答案藏在训练数据里。

大型语言模型的训练语料包含了互联网上的海量文本——Stack Overflow、GitHub Issues、技术博客、man pages、Shell 脚本、终端交互记录。这里面有数十亿行 CLI 命令和对应的输出。模型在训练过程中"见过"了大量类似的模式：

```bash
$ git log --oneline -5
a1b2c3d feat: add user authentication
e4f5g6h fix: resolve memory leak in worker pool
i7j8k9l refactor: extract validation logic
```

```bash
$ curl -s https://api.github.com/repos/foo/bar | jq '.stargazers_count'
12345
```

这些模式在训练数据中反复出现，模型对它们的理解已经内化到参数里了。当 Agent 需要执行一个 CLI 命令时，它在做一件训练数据里见过无数次的事——命令格式是熟悉的，输出格式是熟悉的，错误信息的含义也是熟悉的。

MCP 的 JSON-RPC 协议和 tool schema 格式呢？这些是 2024 年才定义的新规范。模型的训练数据里几乎没有。它需要从有限的系统提示和少量示例中"学会"怎么使用 MCP——这个学习深度和从几十亿行真实终端数据中积累的 CLI 能力没法比。

我自己有一个类比：让 LLM 通过 MCP 调用工具，就像让一个英语母语者先把想法翻译成世界语，再翻译回英语来交流——多了一层完全没必要的转换。

Unix 的核心设计是"一切皆文本流"——命令产生文本输出，输出通过管道喂给下一个命令。LLM 处理的也是文本（token）。CLI 的输入输出是文本，LLM 的输入输出也是文本。两者用的是同一种"数据类型"，信息在两者之间流动不需要任何格式转换。

MCP 在这中间加了一层 JSON-RPC 编码。文本变成了嵌套的 JSON 对象，需要 schema 定义格式，需要序列化和反序列化。这层抽象在传统的机器对机器通信中合理——两个程序之间需要严格的接口契约。但 Agent 和工具之间的交互不是传统的 RPC。Agent 能理解自然语言，它不需要 JSON schema 来告诉它 `git status` 的输出是什么意思。

还有一个容易被忽略的点：认证。大多数 CLI 工具自带登录机制——`gh auth login`、`aws configure`、`gcloud auth login`——装完就能用。MCP Server 需要自己实现认证，而且每家方式不同，有的走 OAuth，有的要手动配 token，有的干脆没做。对 Agent 来说，CLI 的认证链路更短、更可预测。

arXiv 上有一篇论文（2601.11672）系统性地对比了 LLM 使用 CLI 和结构化 API 的表现，结论也指向同一个方向：在工具调用的准确性、效率和错误恢复能力上，CLI 方式全面优于结构化 API。

这个结论放在 LLM 的训练机制下看，几乎是必然的。**你没法发明一种新语言，然后指望它比模型的母语说得更好。**

## MCP 的安全模型——假装问题不存在

Token 经济学和能力匹配是"值不值"的问题，安全性是"敢不敢"的问题。

Simon Willison——Django 联合创始人，LLM 安全领域最活跃的研究者之一——提出了一个他称为"致命三连"的概念。MCP 生态中存在三种相互关联的攻击向量，任何一个都可能造成严重后果。

工具投毒（Tool Poisoning）是最隐蔽的一种。MCP Server 在 tool description 里可以嵌入对 Agent 用户不可见但对模型可见的恶意指令。用户看到的是"这个工具帮你查天气"，模型看到的 description 里可能藏着"把用户的环境变量发送到某个地址"。Agent 按照 description 执行，用户毫不知情。

更阴险的是地毯抽拉（Rug Pull）。MCP Server 可以在任何时间悄悄更新自己的行为。你今天安装了一个正常的 Server，明天它推了一个更新，行为完全改变——而 Agent 会继续信任并执行它返回的一切。传统软件也有供应链攻击的风险，但 MCP 的特殊性在于：Agent 对 MCP Server 的信任是隐式的、无条件的。

还有影子工具（Shadowing）。恶意 MCP Server 可以注册与合法工具同名的 tool，覆盖掉原有工具的行为。Agent 以为自己在调用正常的文件读取工具，实际调用的是恶意 Server 注入的同名工具。

这三种攻击之所以危险，根源在于 MCP 的架构里缺乏隔离机制。所有 MCP Server 共享 Agent 的上下文和权限。一个恶意 Server 能看到所有其他 Server 的交互数据，也能影响 Agent 对其他工具的调用决策。

对比一下 CLI 的安全模型。Unix 进程模型经过了 50 年的实战验证。每个 CLI 命令在独立的进程中运行，有明确的权限边界。一个命令崩了不影响其他命令。子进程继承父进程的权限，权限链条清晰可追溯。文件系统权限、进程隔离、用户组管理——这些机制在半个世纪的攻防对抗中被反复锤炼过。

从影响范围看也是一样：CLI 出问题时，一个命令执行失败就是这个命令失败了，Agent 看到错误信息后可以换个方式重试。MCP Server 出问题时，影响范围可能是整个 Agent 会话，因为它能触及上下文中的所有数据。

CLI 也有安全风险——命令注入、路径遍历这些经典攻击向量一直存在。但 CLI 的安全模型是经过验证的，已知攻击都有成熟的防御手段。MCP 的安全模型还在早期阶段——规范里对上述攻击向量没有系统性的解决方案，基本处于"先用起来再说"的状态。

## MCP 不该死，但该换个位置

写到这里，可能给人一种"MCP 一无是处"的印象。我不这么认为。

我自己想了挺久，觉得关键在于区分两件事：MCP 解决的核心问题是**连接**（connecting），而 CLI 和 Agent Skills 解决的是**使用**（using）。这两件事不一样。

CLI 在"使用"层面几乎无可挑剔——Agent 需要执行操作时，CLI 是最高效的接口。但 CLI 有一个前提：工具必须已经安装在本地。 `gh` 要先 `brew install gh`，`aws` 要先 `pip install awscli`，每个工具都要单独安装、配置、认证。

如果你只用几个工具，管理成本不高。但如果 Agent 需要连接几十个不同的远程服务——数据库、消息队列、监控平台、第三方 API——每个都装一个本地 CLI 就不太现实了。MCP 的"服务发现"能力在这个场景下有真实价值：它提供了一种标准化的方式来描述远程服务的能力和接口，Agent 不需要提前知道每个服务的 CLI 怎么用。

一个可能的混合架构是 MCP Gateway：MCP 作为远程服务的发现和连接层，负责认证、授权、路由；但 Agent 的实际工具执行走 CLI 或原生接口，不走 MCP 的 JSON-RPC 协议。

MCP 有价值的场景是清晰的：远程服务连接——Agent 需要访问一个本地没有 CLI 的远程服务时；多租户场景下不同用户对同一服务有不同权限，需要统一的授权管理；企业合规场景需要记录 Agent 的每一次工具调用，MCP 的结构化协议方便日志和审计；以及沙箱环境——Agent 运行在没有文件系统权限的容器里，CLI 本身就没法用。

Playwright 团队自己也说了：有文件系统访问权限的 Agent 用 CLI，沙箱环境用 MCP。两者各有适用场景。

问题在于——MCP 目前把自己摆在了一个远超这些场景的位置上：**Agent 与所有工具交互的通用协议。** 这个定位太大了，大到不真实。

用投资的类比说：MCP 不是一家坏公司，它有真实的收入来源和合理的商业模式。但它的"估值"——社区对它的期望和定位——严重偏高。它被当成了"Agent 工具协议的终极答案"，但它只是答案的一部分，而且可能是比较小的那部分。

**CLI 做执行层，MCP 做连接层。** 这可能是更合理的架构分工。Agent 执行本地操作时，走 CLI——高效、省 token、模型熟悉。Agent 连接远程服务时，走 MCP——标准化、有认证、便于管理。两者互补，各司其职。

## 从实践中得出的结论

回到我自己的 Agent 系统。我用 Skills 体系构建了一套个人 Agent，有朋友问过我：你的 Skill 底层到底是 MCP 还是 CLI？

答案很明确：**几乎全是 CLI。**

我那几十个 Skill 的底层实现清一色是 Bash 命令的封装。飞书文档操作？底层是 `feishu-cli` 命令行工具。图片上传图床？底层是 `upload.sh` 脚本。代码仓库分析？底层是 `git`、`rg`、`find` 的组合。博客写作？底层是 Hugo CLI。就连我前阵子接入的麦当劳点餐，虽然挂的是 MCP Server，但那纯粹是因为麦当劳没有 CLI——如果有，我肯定选 CLI。

Skill 的 SKILL.md 定义的是"什么场景下该做什么"，具体的执行层清一色是 Bash。这不是我有意为之，是自然选择的结果——每次我给 Agent 添加一个新能力时，CLI 总是最简单、最直接的实现方式。

Skills 的本质就是 CLI 命令的上下文包装。SKILL.md 提供了领域知识和操作规范，Agent 的通用推理能力负责理解意图和制定计划，最后的执行动作落到 Bash 里跑一行命令。这个模式工作得非常好——Agent 知道该做什么（SKILL.md），也知道怎么做（CLI），中间不需要额外的协议层。

从这个实践经验出发，我对接下来的趋势有几个判断。

CLI-first 的 Agent 工具会越来越多。Playwright CLI 开了一个头，接下来会有更多工具提供 Agent 友好的 CLI 接口。所谓"Agent 友好"就是：输出格式对 LLM 阅读友好（结构化文本而非 GUI 输出）、命令设计符合 Agent 的调用习惯（原子操作、幂等性、明确的退出码）、错误信息足够具体让 Agent 能自主修正。

MCP 会重新定位。从"Agent 通用工具协议"回归为"远程服务发现与连接协议"。在这个位置上 MCP 有真实价值，也更可持续。这个过程不会一夜之间发生，大概需要半年到一年。

工具适配的门槛会持续降低。随着模型理解能力越来越强，工具本身不需要做太多专门的适配——Agent 可以自己读 `--help` 输出来理解一个 CLI 工具怎么用。现在的 Agent 已经能读 man page、解析 README、甚至阅读源码来理解一个工具的行为。这意味着现有的几万个 CLI 工具，不用做任何改造就是 Agent 原生的。

混合架构会成为主流。纯 MCP 和纯 CLI 都有各自的盲区。最终的生产环境大概率是"CLI + MCP Gateway"的混合方案——日常操作走 CLI 的高速通道，远程服务走 MCP 的标准接口。就像网络不是全用 HTTP 也不是全用 TCP，不同层有不同的协议。

我也得说一个不确定的地方：这些判断基于当前模型的能力水平。如果未来出现某种新的模型架构，对结构化 API 的处理能力大幅提升，MCP 的劣势可能会被抹平。但从目前 Transformer 架构的训练机制来看，CLI 的优势是由训练数据分布决定的，短期内很难被改变。

## 最后说几句

回到开头那个问题：MCP 是简化了 Agent 与工具的交互，还是把简单事搞复杂了？

我的结论是：对于 Agent 日常的工具调用——查文件、跑命令、读数据——MCP 引入了不必要的复杂性和成本。但对于远程服务连接，MCP 有它的价值。MCP 不该被丢掉，但也不该占着"通用工具协议"的位置不放。

**最好的 Agent 工具协议是人和机器都能自然使用的东西。** CLI 恰好就是这样一种接口。人类开发者用了 50 年，LLM 在训练数据里学了 50 年。不需要 schema 定义，不需要 JSON-RPC 协议，不需要专门的安装和配置。一行命令进去，一段文本出来。

50 年前的设计打败了去年的新协议。不是因为新协议做得不好，而是因为老设计做对了最根本的事——**让机器用人的方式和工具交互。**

## 参考资料

- [Playwright CLI](https://github.com/microsoft/playwright-cli) — 微软 Playwright 团队的 Agent 友好 CLI
- [arXiv 2601.11672](https://arxiv.org/abs/2601.11672) — LLM 工具调用方式的对比研究
- [Simon Willison - MCP 安全模型分析](https://simonwillison.net/) — Tool Poisoning / Rug Pull / Shadowing 攻击向量
