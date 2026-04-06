---
title: "[Anthropic 官方] 构建 Claude Code 的经验：我们如何使用 Skills"
date: 2026-03-18T12:02:19+08:00
draft: true
featured_image: "https://img.riba2534.cn/images/2026/04/f2d56dab_69ba2469667b6.jpg"
description: "Anthropic 内部数百个 Skills 的实战经验总结：9 大类型、编写技巧、分发策略"
tags:
- 转载
- Claude Code
- AI
- Agent
categories:
- AI
comment: true
---

> - 原文链接：[Lessons from Building Claude Code: How We Use Skills](https://x.com/trq212/status/2033949937936085378)
> - 原文作者：[Thariq Shihipar](https://x.com/trq212)（[@trq212](https://x.com/trq212)），Anthropic 产品负责人，Claude Code 的核心构建者之一。他也是 Claude Code Voice Mode 和 Claude Agent SDK 的主要推动者。个人主页：[thariq.io](https://www.thariq.io/)
> - 原文发布时间：2026 年 3 月 18 日 00:53（UTC+8）
> - 本文为转载翻译，原文为英文，以下为中文翻译版本。

![](https://img.riba2534.cn/images/2026/04/f2d56dab_69ba2469667b6.jpg)

Skills 已经成为 Claude Code 中最常用的扩展点之一。它们灵活、容易制作、分发也简单。

但这种灵活性也让人很难知道什么才是最佳实践。哪些类型的 Skills 值得做？写好一个 Skill 的秘诀是什么？什么时候应该把它分享给别人？

我们在 Anthropic 内部大量使用 Claude Code 的 Skills，**目前有数百个 Skills 在日常使用中**。以下是我们在用 Skills 加速开发过程中总结出来的经验。

## 什么是 Skills？

如果你刚接触 Skills，我推荐先阅读我们的文档或者在 Skilljar 上观看关于 Agent Skills 的最新课程，这篇文章假设你已经对 Skills 有了基本了解。

关于 Skills，我们经常听到一个误解：它们"只是 markdown 文件"。但 Skills 最有意思的地方恰恰在于，**它们不只是文本文件，而是可以包含脚本、资源、数据等内容的文件夹**，Agent 可以发现、探索和操作这些内容。

在 Claude Code 中，Skills 还有丰富的配置选项，包括注册动态 hooks。

我们发现，Claude Code 中一些最有意思的 Skills 正是创造性地利用了这些配置选项和文件夹结构。

## Skills 的类型

在梳理了我们所有的 Skills 之后，我们注意到它们聚集在几个反复出现的类别中。**好的 Skills 通常清晰地归属于某一类；让人困惑的 Skills 往往横跨多个类别。** 这不是一份最终定义的清单，但它是一个很好的方式来检查你的组织中是否遗漏了某些类型。

![Skills 的 9 大类型](https://img.riba2534.cn/images/2026/04/ef7e6b35_69ba246a3c80b.jpg)

### 1. 库与 API 参考

用来说明如何正确使用某个库、CLI 或 SDK 的 Skills。既可以是内部库，也可以是 Claude Code 有时会处理不好的常用库。这类 Skills 通常包含一个参考代码片段文件夹和一份让 Claude 在写脚本时需要避免的坑的列表。

示例：

- **billing-lib** — 你的内部计费库：边界情况、容易踩的坑等
- **internal-platform-cli** — 你们内部 CLI 封装的每个子命令及其使用场景
- **frontend-design** — 让 Claude 更好地使用你们的设计系统

### 2. 产品验证

描述如何测试或验证代码是否正常工作的 Skills。它们通常与 Playwright、tmux 等外部工具配合使用来执行验证。

验证类 Skills 对于确保 Claude 输出的正确性非常有用。**值得让一个工程师花一周时间专门把验证类 Skills 做好。**

可以考虑一些技巧，比如让 Claude 录制输出视频以便你能看到它到底测试了什么，或者在每个步骤强制执行程序化断言来检查状态。这些通常通过在 Skill 中包含各种脚本来实现。

示例：

- **signup-flow-driver** — 在无头浏览器中跑完注册 → 邮件验证 → 引导流程，每一步都有状态断言的 hooks
- **checkout-verifier** — 用 Stripe 测试卡驱动结账 UI，验证发票是否真的落到了正确的状态
- **tmux-cli-driver** — 用于需要 TTY 的交互式 CLI 测试

### 3. 数据获取与分析

连接你的数据和监控系统的 Skills。这类 Skills 可能包含带凭证的数据获取库、特定的 dashboard ID 等，以及常见工作流或获取数据方式的说明。

示例：

- **funnel-query** — "要看注册 → 激活 → 付费，我应该 join 哪些事件"，以及实际存储规范 user_id 的表
- **cohort-compare** — 对比两个用户群的留存或转化率，标记统计显著的差异，链接到分段定义
- **grafana** — 数据源 UID、集群名称、问题 → dashboard 的查找表

### 4. 业务流程与团队自动化

把重复性工作流自动化为一条命令的 Skills。这类 Skills 通常是比较简单的指令，但可能对其他 Skills 或 MCP 有更复杂的依赖。对于这类 Skills，**把之前的执行结果保存在日志文件中可以帮助模型保持一致性并反思之前的执行情况。**

示例：

- **standup-post** — 聚合你的工单跟踪器、GitHub 活动和之前的 Slack 消息 → 格式化的站会汇报，只显示增量变化
- **create-\<ticket-system\>-ticket** — 强制要求 schema（有效的枚举值、必填字段）以及创建后的工作流（ping 审查者、在 Slack 中发链接）
- **weekly-recap** — 已合并的 PR + 已关闭的 ticket + 部署 → 格式化的周报

### 5. 代码脚手架与模板

为代码库中特定功能生成框架样板代码的 Skills。你可以把这些 Skills 和可组合的脚本结合使用。当你的脚手架有纯代码无法完全覆盖的自然语言要求时，它们特别有用。

示例：

- **new-\<framework\>-workflow** — 用你的注解搭建新的 service/workflow/handler
- **new-migration** — 你的迁移文件模板加上常见的坑
- **create-app** — 预装了你们的认证、日志和部署配置的新内部应用

### 6. 代码质量与 Review

在组织内部执行代码质量标准并帮助审查代码的 Skills。这些可以包含确定性的脚本或工具以获得最大的鲁棒性。你可能想把这些 Skills 作为 hooks 的一部分自动运行，或者放到 GitHub Action 中。

- **adversarial-review** — 生成一个全新视角的子 Agent 来挑刺，实施修复，迭代直到发现只剩下 nitpick 级别
- **code-style** — 强制执行代码风格，特别是 Claude 默认做得不好的那些风格
- **testing-practices** — 关于如何写测试和测什么的指南

### 7. CI/CD 与部署

帮助你在代码库中获取、推送和部署代码的 Skills。这些 Skills 可能会引用其他 Skills 来收集数据。

示例：

- **babysit-pr** — 监控一个 PR → 重试不稳定的 CI → 解决合并冲突 → 启用自动合并
- **deploy-\<service\>** — 构建 → 冒烟测试 → 逐步流量切换并比较错误率 → 出现回退时自动回滚
- **cherry-pick-prod** — 隔离的 worktree → cherry-pick → 冲突解决 → 使用模板创建 PR

### 8. Runbook

接收一个症状（比如 Slack 讨论串、告警或错误签名），走完多工具调查流程，输出结构化报告的 Skills。

示例：

- **\<service\>-debugging** — 为你流量最大的服务映射 症状 → 工具 → 查询模式
- **oncall-runner** — 获取告警 → 检查常见嫌疑 → 格式化调查结果
- **log-correlator** — 给定一个 request ID，从每个可能触及它的系统中拉取匹配的日志

### 9. 基础设施运维

执行日常维护和运维操作的 Skills——其中一些涉及需要护栏的破坏性操作。这些让工程师在关键操作中更容易遵循最佳实践。

示例：

- **\<resource\>-orphans** — 找到孤立的 pod/volume → 发到 Slack → 冷静期 → 用户确认 → 级联清理
- **dependency-management** — 你们组织的依赖审批工作流
- **cost-investigation** — "为什么我们的存储/出口流量账单飙升了"，附带具体的 bucket 和查询模式

---

## 编写 Skills 的技巧

决定好要做什么 Skill 之后，怎么写？以下是我们发现的一些最佳实践、技巧和窍门。

我们最近也发布了 Skill Creator，让在 Claude Code 中创建 Skills 变得更容易。

![编写 Skills 的 9 个技巧](https://img.riba2534.cn/images/2026/04/d68ffb2b_69ba246ad36cf.jpg)

### 不要陈述显而易见的事情

Claude Code 对你的代码库了解很多，Claude 本身也对编程了解很多，包括很多默认的观点。如果你要发布一个主要关于知识的 Skill，试着聚焦于那些**能把 Claude 推出其正常思维方式的信息**。

frontend-design Skill 就是个好例子——它是 Anthropic 的一位工程师通过和客户反复迭代来提升 Claude 的设计品味的成果，避免了 Inter 字体和紫色渐变这类经典模式。

### 建立一个 Gotchas 段落

任何 Skill 中**信息密度最高的内容就是 Gotchas 段落**。这些段落应该从 Claude 使用你的 Skill 时遇到的常见失败点中不断积累。理想情况下，你应该随着时间推移持续更新你的 Skill 来捕获这些 gotchas。

![Gotchas 段落的演进：第 1 天 → 第 2 周 → 第 3 个月](https://img.riba2534.cn/images/2026/04/c79606e5_69ba246b9cd10.jpg)

### 使用文件系统和渐进式披露

就像前面说的，一个 Skill 是一个文件夹，不只是一个 markdown 文件。你应该把整个文件系统当作上下文工程和渐进式披露的一种形式。告诉 Claude 你的 Skill 里有哪些文件，它会在合适的时机去读取它们。

最简单的渐进式披露形式是指向其他 markdown 文件供 Claude 使用。比如，你可以把详细的函数签名和使用示例拆分到 `references/api.md` 中。

另一个例子：如果你的最终输出是一个 markdown 文件，你可以在 `assets/` 中放一个模板文件让 Claude 复制和使用。

**你可以有参考文档、脚本、示例等文件夹**，这些都能帮助 Claude 更高效地工作。

![渐进式披露：hub 文件分发，spoke 文件干活](https://img.riba2534.cn/images/2026/04/a6d226e3_69ba246c46da8.jpg)

### 避免过度限制 Claude

Claude 通常会尽力遵循你的指令，而且因为 Skills 有很高的复用性，你需要小心不要在指令中过于具体。给 Claude 提供它需要的信息，但给它灵活性来适应具体情况。比如：

![过度限制 vs 更好的写法](https://img.riba2534.cn/images/2026/04/cea991b1_69ba246ce0ff5.jpg)

### 想清楚初始配置

有些 Skills 可能需要用户提供上下文来完成初始配置。比如，如果你做了一个把站会汇报发到 Slack 的 Skill，你可能需要 Claude 先问一下发到哪个 Slack 频道。

一个好的模式是把这些配置信息存储在 Skill 目录下的 `config.json` 文件中，如上面的例子所示。如果配置还没设置，Agent 就可以询问用户来获取信息。

如果你希望 Agent 展示结构化的多选题，你可以指示 Claude 使用 AskUserQuestion 工具。

![standup-post 的初始配置示例](https://img.riba2534.cn/images/2026/04/3f199961_69ba246dcb092.jpg)

### description 字段是写给模型看的

当 Claude Code 启动一个会话时，它会构建一份所有可用 Skills 及其 description 的清单。Claude 靠扫描这份清单来决定"这个请求有没有对应的 Skill？"。这意味着 **description 字段不是一个摘要——它是对何时触发这个 Skill 的描述**。

![description 字段的对比：左边是泛泛的描述，右边是精确的触发条件](https://img.riba2534.cn/images/2026/04/4ee7332f_69ba246e54997.jpg)

### 记忆与数据存储

有些 Skills 可以通过在自身目录中存储数据来实现一种记忆形式。你可以用任何东西来存储数据，简单到一个只追加的文本日志文件或 JSON 文件，复杂到一个 SQLite 数据库。

比如，一个 standup-post Skill 可能会维护一个 `standups.log`，记录它写过的每一篇站会汇报。这样下次你运行它的时候，Claude 会读取自己的历史记录，就能分辨出昨天以来发生了什么变化。

存储在 Skill 目录中的数据可能在你升级 Skill 时被删除，所以你应该把数据存储在一个稳定的文件夹中。目前我们提供了 `${CLAUDE_PLUGIN_DATA}` 作为每个插件的稳定数据存储文件夹。

![Memory 示例：使用 ${CLAUDE_PLUGIN_DATA} 持久化数据](https://img.riba2534.cn/images/2026/04/19b27bc0_69ba246f18f8c.jpg)

### 存储脚本与生成代码

**你能给 Claude 最强大的工具之一就是代码。** 给 Claude 提供脚本和库，可以让 Claude 把精力花在组合上——决定下一步做什么，而不是从头构建样板代码。

比如，在你的数据分析 Skill 中，你可能有一个函数库来从你的事件源获取数据。为了让 Claude 做复杂分析，你可以提供一组这样的辅助函数：

![lib/signups.py 辅助函数库](https://img.riba2534.cn/images/2026/04/5f920582_69ba247001400.jpg)

Claude 接下来就可以动态生成脚本来组合这些功能，完成更高级的分析。比如面对"周二发生了什么？"这样的问题：

![investigate.py — Claude 生成的分析脚本](https://img.riba2534.cn/images/2026/04/cacd8811_69ba2470b83eb.jpg)

### 按需 Hooks

Skills 可以包含只在被调用时激活、并在整个会话期间持续生效的 hooks。把这个用于那些你不想一直运行、但有时候又特别有用的偏执型 hooks。

比如：

- **/careful** — 通过 PreToolUse matcher 拦截 Bash 中的 `rm -rf`、`DROP TABLE`、force-push、`kubectl delete`。你只在碰生产环境的时候才需要它——如果一直开着会让你抓狂
- **/freeze** — 阻止对特定目录以外的任何 Edit/Write 操作。在调试时很有用："我想加日志但我总是不小心'修'了不相关的代码"

---

## 分发 Skills

Skills 最大的好处之一是你可以把它们分享给团队的其他成员。

有两种方式可以和他人分享 Skills：

- **把 Skills 提交到你的代码仓库**（放在 `./.claude/skills` 下）
- **做成插件并放到 Claude Code 插件市场**，让用户可以上传和安装插件（详情参阅文档）

对于在较少仓库上工作的小团队来说，把 Skills 提交到仓库中效果很好。但每一个提交的 Skill 也会给模型的上下文增加一些负担。随着规模扩大，**一个内部插件市场可以让你分发 Skills 并让团队成员自行决定安装哪些**。

### 管理市场

怎么决定哪些 Skills 进入市场？人们怎么提交？

我们没有一个集中的团队来决定这些；相反，我们试图有机地发现最有用的 Skills。如果你有一个想让人们试试的 Skill，你可以把它上传到 GitHub 的沙箱文件夹中，然后在 Slack 或其他论坛中指引别人去看。

一旦一个 Skill 获得了足够的吸引力（这由 Skill 的拥有者来判断），他们就可以提交 PR 把它移入市场。

有一个需要注意的地方：**创建低质量或冗余的 Skills 非常容易**，所以确保在发布前有某种审核机制是很重要的。

### 组合 Skills

你可能会有相互依赖的 Skills。比如，你可能有一个文件上传 Skill 用来上传文件，以及一个 CSV 生成 Skill 用来生成 CSV 并上传。这种依赖管理还没有原生内建到市场或 Skills 中，但你可以直接按名称引用其他 Skills，模型会在它们已安装的情况下调用它们。

### 衡量 Skills 的效果

为了了解一个 Skill 的使用情况，我们使用一个 PreToolUse hook 来记录公司内部的 Skill 使用情况（示例代码见原文）。这意味着我们可以发现哪些 Skills 很受欢迎，或者哪些的触发频率低于我们的预期。

---

## 结语

Skills 是非常强大、灵活的 Agent 工具，但现在还处于早期阶段，我们都还在摸索如何最好地使用它们。

与其把这篇文章当作一份权威指南，不如把它当作我们见过有效的实用技巧合集。理解 Skills 的最好方式是动手开始、多做实验、看看什么对你有效。我们的大多数 Skills 一开始只有几行内容和一个 gotcha，后来因为大家不断把 Claude 遇到的新边界情况添加进去，才变得越来越好。

希望这篇文章对你有帮助，有问题欢迎随时交流。
