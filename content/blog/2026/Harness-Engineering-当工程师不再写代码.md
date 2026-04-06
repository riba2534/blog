---
title: "Harness Engineering：当工程师不再写代码"
date: 2026-03-19T11:35:00+08:00
draft: false
featured_image: "https://img.riba2534.cn/images/2026/04/30646565_69bb8304125fc.jpg"
description: "从 Prompt Engineering 到 Context Engineering 再到 Harness Engineering，工程师的角色正在发生根本性转变。"
tags:
- AI
- Claude Code
- Harness Engineering
- Agent
categories:
- AI
comment: true
---

最近用 Claude Code 写代码，有个事一直困扰我——写 CLAUDE.md 花的时间比写代码还多。

不是写一次就完事。每次 Agent 犯了一个错，我就得回去改 CLAUDE.md，加一条规则、调一个约束、补一段上下文。改完再跑，大概率又冒出新问题，于是再改。这个循环反复了几十次之后，CLAUDE.md 变成了几百行的文档，里面有架构规范、命名约定、错误处理策略、甚至"禁止做什么"的负面清单。

我一度觉得这是在浪费时间。写代码才是正事吧？

直到 2 月份 OpenAI 发了一篇文章，标题是《[Harness Engineering: Leveraging Codex in an Agent-First World](https://openai.com/index/harness-engineering/)》。读完之后我意识到——写 CLAUDE.md 可能不是浪费时间，那就是工作本身。

## 一百万行代码，零行手写

OpenAI 做了一个实验：3 个工程师，5 个月，用 Codex Agent 从空仓库开始构建了一个超过 100 万行代码的产品。

5 个月里他们合并了大约 1,500 个 PR，平均每人每天 3.5 个。所有代码由 Codex 生成，没有一行手写。

乍一看像是一个"AI 多牛"的宣传故事。但仔细读下来，最有价值的部分是他们踩了哪些坑。

早期进展比预期慢得多。不是因为 Codex 编码能力不够，而是因为环境没搭好。Agent 不知道项目的依赖结构、不理解架构约束、无法验证产出是否正确。给它一个任务，它能写出代码，但写出来的代码经常违反项目的设计原则——然后就需要人来 review、人来改、人来解释"为什么不能这么做"。

和一个新人入职的体验几乎一样：能力没问题，但不了解组织的规矩。

团队花了大量时间做一件事：**把规矩写下来，让机器能读懂。**

他们设计了严格的依赖方向——Types → Config → Repo → Service → Runtime → UI——然后把这个约束编码成自定义 Linter 规则。CI 自动拒绝违反规则的代码，不需要在 code review 里口头传达"我们这里不允许跨层调用"。他们写了一份大约 100 行的 AGENTS.md，OpenAI 管它叫"地图，而不是百科全书"——只告诉 Agent 最关键的导航信息，不试图把所有知识塞进去。

他们还建了一套本地可观测性系统：每个 git worktree 启动一个独立的应用实例，Agent 通过 Chrome DevTools Protocol 直接操控浏览器来验证 UI 是否正确。Agent 可以随时查看自己产出的效果——不用等人来检查。

一个细节值得记一下——团队最初每周五花 20% 的时间清理 Agent 产出的"AI slop"：风格不一致、过度抽象、命名奇怪的代码。后来他们把清理标准编码成了"golden principles"，让 Codex 根据这些原则自动重构。从人工清理到自动清理——又是一个反馈回路的闭合。

OpenAI 用一句话总结核心哲学：**Humans steer. Agents execute.**

人负责掌舵，Agent 负责执行。

那问题来了——如果工程师不写代码了，他们到底在干什么？

## 从 Prompt 到 Context 到 Harness

过去两年，和 AI 打交道的方式经历了三个阶段。

Prompt Engineering 阶段，核心问题是"怎么把一句话说清楚"。你小心翼翼地措辞，加上"请一步一步思考"这类咒语，试图榨出更好的回答。

Context Engineering 阶段，你发现光说清楚还不够，关键是把必要信息喂进去。RAG、向量数据库、动态上下文组装——技术越来越复杂，但核心问题没变：怎么让模型在做决策时手里有足够的信息。

Harness Engineering 阶段，你要解决的不再是"这一次对话怎么答好"，而是"整个环境怎么搭成一个可持续运行的系统"。

| 阶段 | 核心问题 | 类比 |
|------|---------|------|
| Prompt Engineering | 怎么把一句话说清楚 | 写一封信 |
| Context Engineering | 怎么把必要信息喂进去 | 准备一份档案 |
| Harness Engineering | 怎么把整个环境搭成系统 | 建一座工厂 |

LangChain 团队把 Harness 拆解成了具体组件，给出了一个公式：**Agent = Model + Harness。**

Harness 是除了模型本身之外的一切——system prompt、工具定义、执行沙箱、编排逻辑、hooks 和中间件。模型是引擎，Harness 是整辆车。引擎再好，没有刹车你也不敢上路。

从模型的局限性出发，可以推导出 Harness 需要解决哪些问题。模型没有长期记忆，那就用文件系统做持久化存储；无法直接操控外部世界，那就给它 Bash 和代码执行能力（ReAct 循环）；可能产出错误代码，那就用沙箱环境让它安全试错。上下文窗口有限怎么办？渐进式信息披露和上下文压缩。缺乏长期规划能力怎么办？任务拆解、自验证、进度追踪。

这些东西单独拿出来看都不新鲜——文件系统、沙箱、任务拆解，哪个不是用了几十年的老技术？新鲜的地方在于把它们组合起来，形成一个围绕 LLM 的执行环境。

拿我每天用的 Claude Code 举例——CLAUDE.md 是记忆层，hooks 是反馈回路，custom agents 是编排层，git worktree 隔离是安全执行层。这些东西我一直在用，但以前从没想过它们合在一起构成了一个"Harness"。

## 同一个模式，出现了三次

一篇分析文章的标题叫《Harness Engineering Is Cybernetics》，论证了一件事：Harness Engineering 不是什么新发明——它是控制论的第三次现身。

**第一次：瓦特的离心调速器，1780 年代。**

蒸汽机刚出现的时候，需要一个工人守在旁边，盯着压力表，手动调节阀门。转速太快就关小阀门，太慢就开大。工人同时充当传感器和执行器。

后来 James Watt 发明了离心调速器——一个带飞球的机械装置，转速快了飞球升高、自动关小阀门，转速慢了飞球降低、自动开大阀门。反馈回路在物理层面闭合了。

工人的角色变了：从亲手拧阀门，到设计调速器本身。

**第二次：Kubernetes，2010 年代。**

你不需要盯着每台服务器的 CPU 和内存，手动 SSH 进去重启挂掉的进程。你声明一个目标状态——"我要 3 个副本、每个 2G 内存"——然后控制器（controller）持续监测实际状态，有偏差就自动修正（reconcile）。

工程师不再手动重启服务，而是编写系统需要对齐的目标 spec。

**第三次：Harness Engineering，现在。**

OpenAI 那 3 个工程师不写代码了。他们设计运行环境、构建反馈回路、把架构约束转化为可执行规则。Agent 生成代码，Linter 和测试自动验证，不合格的自动打回重来。

工程师的工作从写代码，变成了设计让代码被正确写出来的系统。

三次转变有一个共同模式：**有人造出了足够好的传感器和执行器，能在那个层面把反馈回路闭合。**

调速器的传感器是飞球，执行器是阀门联动装置。Kubernetes 的传感器是 metrics 和 health check，执行器是调度器。Harness Engineering 的传感器是测试、Linter 和可观测性，执行器是 LLM。

Norbert Wiener 在 1948 年把这种模式命名为控制论（cybernetics）。这个词来自希腊语 kubernetes——舵手。没错，就是 Kubernetes 的词源。你不再亲手划桨，你开始掌舵。

那为什么代码库是最后被攻克的领域？

编译器早就能检测语法错误了。测试框架能验证行为是否正确。Linter 能检查代码风格。但这些都是底层的反馈回路——它们能告诉你"这行代码有语法错误"或"这个函数返回值不对"，却没办法告诉你"这个架构决策合不合理"、"这个抽象层次划分得对不对"。

架构层面的判断，既没有传感器来感知，也没有执行器来修正。直到 LLM 出现——它既能理解代码的意图（传感器），又能生成新代码（执行器）。当你把架构规范写成 AGENTS.md、把设计约束编码成自定义 Linter、把团队对代码质量的标准变成可执行的 CI 检查，你就在架构层面闭合了反馈回路。

Nicholas Carlini 做过一个实验：让 16 个 Agent 并行构建一个 C 编译器。prompt 极其简单，但测试基础设施的设计极其精心。Carlini 自己说："**我大部分的精力都花在设计 Claude 周围的环境上。**"——和 OpenAI 那 3 个工程师做的事情如出一辙。

## Harness 的解剖学

Harness 到底长什么样？

一篇广泛传播的分析文章《The Harness Is Everything》给出了一个更激进的论断："模型几乎无关紧要。Harness 才是一切。"

文章提出了一个 7 层分类框架：

| 层级 | 名称 | 做什么 |
|------|------|--------|
| 1 | Human Oversight | 人类监督——最终决策权 |
| 2 | Spec Tools | 规格工具——把需求变成 Agent 可执行的任务描述 |
| 3 | Full Lifecycle Platforms | 全生命周期平台——从 spec 到部署的端到端管理 |
| 4 | Task Runners | 任务执行器——大任务拆解为可并行的子任务 |
| 5 | Agent Orchestrators | Agent 编排器——协调多个 Agent 协作 |
| 6 | Harness Frameworks/Runtimes | Harness 框架和运行时——通用执行环境 |
| 7 | Coding Agents | 编码 Agent——商品化层 |

最底层的 Coding Agent——Claude Code、Cursor、Codex 这些——反而是最容易被替代的商品化层。壁垒在上面几层：你怎么定义 spec、怎么编排任务、怎么做人类监督。

跨越各个项目，有一些反复出现的设计模式。我把几个最关键的展开说说。

不要一次性把所有文档塞给 Agent。OpenAI 用 `docs/` 目录做结构化组织，Agent 根据当前任务按需加载。Claude Code 的 skills 机制也是同一个思路——技能描述只占几十个 token，需要用的时候才加载完整内容。这种"渐进式信息披露"（Progressive Disclosure）把信息的供给从"一次性灌入"变成了"按需拉取"，大幅降低了上下文窗口的压力。

每个 Agent 应该在独立的 git worktree 里干活，互不干扰。改坏了直接丢掉，不影响主分支。这让 Agent 可以大胆试错——失败的成本几乎为零。

任务定义、架构约束、质量标准，全都写在仓库里。不靠 Slack 消息传递，不靠口头约定。Agent 读仓库就能拿到所有需要的信息。这个思路叫"Repo as System of Record"——仓库就是真理来源。

架构约束要靠机械化手段执行。不靠 code review 里的一句"建议不要这么做"，而是用 CI 规则硬卡——违反了直接编译不过、PR 合不进去。人可以被说服，Linter 不会。

测试、类型检查、浏览器端到端验证这些反馈回路，要嵌入到 Agent 的执行循环内部。Agent 每生成一段代码就自动验证，不通过就自动修复再跑，直到通过为止。这和人工 review 后手动修改有本质区别——反馈延迟从小时级缩短到了秒级。

SWE-agent 的论文数据也印证了这一点：同一个模型，仅靠 Agent-Computer Interface 的设计改进，就获得了 **64% 的性能提升**。模型没变，变的只是 Harness。

## 跳过这些事的代价

文档、测试、架构约束——这些"最佳实践"我们喊了 30 年。为什么今天突然变得紧迫？

因为代价的兑现速度变了。

以前，一个开发者写出了违反架构规范的代码。代价是什么？Code review 被打回，改一遍，重新提交。如果 review 没发现呢？技术债慢慢累积，几个月后某次重构时集中爆发。不管哪种，代价来得慢、散得开，你可以拖。

Agent 时代这个等式变了。一个没有被规范约束的 Agent，会以机器的速度、全天候地重复同样的错误。一个很精准的描述是："跳过文档，Agent 就会无视你的约定——在每一个 PR 里，以机器的速度，全天候运行。"

OpenAI 团队的亲身体会是：早期没有把架构约束编码成 Linter 规则的时候，Codex 生成的代码大量违反依赖方向。每一次都犯。因为 Agent 不会"耳濡目染"——你没写下来的规矩，它永远不知道。

Ben Thompson 在 Stratechery 的《Agents Over Bubbles》里提供了一个更底层的解释：代码是概率输入和确定性输出的完美匹配。

LLM 生成代码的过程是概率性的——每个 token 都是采样出来的。但代码可以被确定性地验证——编译能不能过、测试跑不跑得通、Linter 有没有报错。这种"生成-验证"的不对称性，让 Agent 在代码领域有了一个巨大优势：**你不需要比机器写得更快，你只需要能高效评估它的产出。**

但这个优势有一个前提——你得有评估的基础设施。

没有测试，拿什么验证 Agent 写的代码是对的？没有 Linter 规则，怎么保证架构约束不被打破？没有 CI 流水线，怎么在每次提交时自动跑这些检查？

IBM Research 的数据让这一点更具体：纯 LLM 代码审查只能捕获约 45% 的错误；LLM 和确定性分析工具结合之后，这个数字跳到了 94%。模型能力只是一半，另一半靠的是 Harness 中的确定性工具链。

LangChain 用另一组数据讲了同样的道理：他们没有换模型，只优化了 Harness——在 Terminal Bench 2.0 上的成绩从 52.8% 升到了 66.5%，排名从 Top 30 跳到了 Top 5。同一个引擎，换了底盘，差距就是这么大。

## 争议与未解之题

行业里对这个方向有真实的分歧。

一边是"Build Heavy Harness"阵营。证据不少：OpenAI 的 100 万行实验；Stripe 每周通过 Minions Agent 合并 1,000+ 个 PR；前面提到的 LangChain 和 SWE-agent 数据；Cursor 拿到 500 亿美元估值——市场在用真金白银投票。

另一边是"Trust The Model"阵营。Anthropic 的 Claude Code 团队明确表示，他们的设计哲学是"模型之上尽可能薄的包装层"——模型能力才是核心，Harness 越轻越好。OpenAI 的研究员 Noam Brown 说过，为较弱模型构建的复杂脚手架，会被更强的模型替代。METR 的研究发现，基础脚手架与专门构建的系统表现相当。Martin Fowler 在他的评论文章里提了两个尖锐的问题：OpenAI 的文章缺少对实际行为正确性的验证——100 万行代码跑起来到底对不对？而且把 Harness 改造到遗留代码库的代价可能过高——从零开始建一个 AI-native 仓库和改造一个 10 年历史的老仓库，完全是两回事。

两边都有道理。我自己的判断：这不是二选一。

模型确实在变强。两年前需要精心构造的 prompt 才能完成的任务，现在直接问就行。一年前需要 RAG 才能处理的长文档，现在塞进上下文窗口就能搞定。按这个趋势，今天需要的一些 Harness 组件，未来确实可能被更强的模型吃掉。

但 Harness 不会因此消失。编译器变得越来越强大，我们并没有丢掉 CI/CD——因为验证和约束是独立于工具能力的需求。你的架构规范不会因为模型变强就不需要了。你的测试不会因为 Agent 写得更好就可以删掉。

Ben Thompson 用价值链理论解释了这一点：利润从商品化的模块流向集成的环节。模型正在被商品化——越来越多公司提供越来越相似的模型。而 model + harness 的集成才是难以复制的差异化。Anthropic 和 OpenAI 的护城河可能不只是模型好，而是模型和 harness 的集成做得好。

我没想清楚的一个问题是：最优的 Harness 厚度到底是什么？

Anthropic 说要"尽可能薄"，OpenAI 建了一套相当重的系统。两家公司都在用 Agent 做生产开发，但选择了截然不同的路径。也许答案取决于项目的规模和生命周期——一个人的 side project 和一个 500 人维护的代码库，需要的 Harness 完全不同。也许这个问题本身就提错了，就像问"代码应该多长"——没有统一答案，取决于你在解决什么问题。

还有一个更大的不确定性：**模型进化的速度会不会快到让精心构建的 Harness 来不及发挥价值就过时了？** 2026 年初的 Deer Valley 研讨会上，一篇立场论文说得很直白——"我们对任何技术在未先解决人和系统层面约束的情况下改善组织绩效的承诺持怀疑态度。"这话听着像给 Harness 站台，但反过来想：如果模型强到不需要那么多系统层面的约束呢？

我倾向于相信 Harness 会长期存在，但具体形态会随着模型能力的变化而演化。就像我们从 Makefile 演化到 CI/CD 再到 GitOps，底层逻辑没变——自动化验证和约束——但具体的工具和实践一直在变。

## 回到那个 CLAUDE.md

现在我理解了为什么写 CLAUDE.md 花的时间比写代码多——那就是这个时代工程师最核心的工作：设计让代码被正确写出来的系统。

瓦特调速器的工人后来没有回去拧阀门。不是因为他们不会拧，而是因为回去拧阀门这件事，已经没有任何意义了。

## 参考资料

1. OpenAI, [Harness Engineering: Leveraging Codex in an Agent-First World](https://openai.com/index/harness-engineering/)
2. Ben Thompson, [Agents Over Bubbles](https://stratechery.com/2026/agents-over-bubbles/), Stratechery
3. George Zhang (@odysseus0z), [Harness Engineering Is Cybernetics](https://x.com/odysseus0z/status/2030416758138634583)
4. 海外独角兽, [控制论视角下的 Harness Engineering](https://mp.weixin.qq.com/s/SVUybMZb6uh5OCR3ceoBVA)
5. Viv Trivedy (@Vtrivedy10), [The Anatomy of an Agent Harness](https://x.com/Vtrivedy10/status/2031408954517971368)
6. Rohit (@rohit4verse), [The Harness Is Everything](https://x.com/rohit4verse/status/2033945654377283643)
7. Martin Fowler, [Harness Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
8. Mitchell Hashimoto, [My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey)
