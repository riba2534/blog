---
title: "长时间运行 Agent 的有效框架设计（Effective Harnesses for Long-Running Agents）"
date: 2026-02-22T16:27:44+08:00
draft: true
featured_image: "https://img.riba2534.cn/images/2026/04/844ff9e7_699abec85402e.gif"
description: "Anthropic 工程团队分享如何让 AI Agent 跨多个上下文窗口保持持续进展的实践方案：初始化 Agent + 编码 Agent 的双 Agent 架构。"
tags:
- 转载
- AI
- Agent
- Claude
- LLM
categories:
- AI
comment: true
---

> 原文链接：[Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
>
> 原文作者：Justin Young
>
> 翻译说明：本文为英中双语对照翻译，一段英文对应一段中文。

As AI agents become more capable, developers are increasingly asking them to take on complex tasks requiring work that spans hours, or even days. However, **getting agents to make consistent progress across multiple context windows remains an open problem**.

随着 AI Agent 能力的不断增强，开发者越来越多地让它们承担需要数小时甚至数天才能完成的复杂任务。然而，**如何让 Agent 在多个上下文窗口之间保持持续、稳定的进展，仍然是一个未解决的问题**。

The core challenge of long-running agents is that they must work in discrete sessions, and each new session begins with no memory of what came before. Imagine a software project staffed by engineers working in shifts, where each new engineer arrives with no memory of what happened on the previous shift. **Because context windows are limited, and because most complex projects cannot be completed within a single window**, agents need a way to bridge the gap between coding sessions.

长时间运行 Agent 的核心挑战在于，它们必须以离散的会话（session）方式工作，而每个新会话开始时都没有此前的记忆。想象一个软件项目由轮班工程师负责，每位新到岗的工程师对上一班发生了什么毫无记忆。**由于上下文窗口有限，且大多数复杂项目无法在单个窗口内完成**，Agent 需要一种方式来衔接不同的编码会话。

We developed a two-fold solution to enable the Claude Agent SDK to work effectively across many context windows: an **initializer agent** that sets up the environment on the first run, and a **coding agent** that is tasked with making incremental progress in every session, while leaving clear artifacts for the next session. You can find code examples in the accompanying quickstart.

我们开发了一套双管齐下的方案，使 Claude Agent SDK 能够在多个上下文窗口之间高效工作：一个用于首次运行时搭建环境的**初始化 Agent（initializer agent）**，以及一个在每次会话中负责推进增量进展、同时为下一次会话留下清晰产物的**编码 Agent（coding agent）**。你可以在配套的快速入门指南（quickstart）中找到代码示例。

## The Long-Running Agent Problem

## 长时间运行 Agent 的问题

The Claude Agent SDK is a powerful, general-purpose agent harness adept at coding, as well as other tasks that require the model to use tools to gather context, plan, and execute. It has context management capabilities such as compaction, which enables an agent to work on a task without exhausting the context window. **Theoretically, given this setup, it should be possible for an agent to continue to do useful work for an arbitrarily long time.**

Claude Agent SDK 是一个功能强大的通用 Agent 框架，擅长编程以及其他需要模型使用工具来收集上下文、规划和执行的任务。它具备上下文管理能力，例如压缩（compaction），可以让 Agent 在不耗尽上下文窗口的情况下持续工作。**理论上，在这种设定下，Agent 应该能够在任意长的时间内持续产出有效工作**。

However, compaction isn't sufficient. Out of the box, even a frontier coding model like Opus 4.5 running on the Claude Agent SDK in a loop across multiple context windows **will fall short of building a production-quality web app** if it's only given a high-level prompt, such as "build a clone of claude.ai."

然而，仅靠压缩是不够的。开箱即用的情况下，即便是像 Opus 4.5 这样的前沿编码模型，运行在 Claude Agent SDK 上并跨多个上下文窗口循环执行，如果仅给出一个高层级的提示词——比如"构建一个 claude.ai 的克隆"——**它也无法构建出生产级质量的 Web 应用**。

Claude's failures manifested in two patterns. First, **the agent tended to try to do too much at once—essentially to attempt to one-shot the app**. Often, this led to the model running out of context in the middle of its implementation, leaving the next session to start with a feature half-implemented and undocumented. The agent would then have to guess at what had happened, and spend substantial time trying to get the basic app working again. This happens even with compaction, which doesn't always pass perfectly clear instructions to the next agent.

Claude 的失败表现为两种模式。第一种是，**Agent 倾向于一次做太多事情——本质上是试图一次性完成整个应用**。这通常导致模型在实现过程中耗尽上下文，使得下一个会话面对的是一个实现了一半且没有文档记录的功能。新 Agent 不得不猜测之前发生了什么，并花费大量时间重新让基础应用恢复运行。即使使用了压缩，这个问题也会出现，因为压缩并不总能将足够清晰的指令传递给下一个 Agent。

A second failure mode would often occur later in a project. After some features had already been built, a later agent instance would look around, see that progress had been made, and **declare the job done**.

第二种失败模式通常发生在项目后期。当一些功能已经构建完成后，后续的 Agent 实例环顾四周，看到已经有了一些进展，**就宣布任务完成了**。

This decomposes the problem into two parts. First, we need to set up an initial environment that lays the foundation for *all* the features that a given prompt requires, which sets up the agent to work step-by-step and feature-by-feature. Second, we should prompt each agent to make incremental progress towards its goal while also leaving the environment in a clean state at the end of a session. By "clean state" we mean the kind of code that would be appropriate for merging to a main branch: **there are no major bugs, the code is orderly and well-documented**, and in general, a developer could easily begin work on a new feature without first having to clean up an unrelated mess.

这将问题分解为两个部分。首先，我们需要搭建一个初始环境，为给定提示词所要求的*所有*功能奠定基础，引导 Agent 逐步骤、逐功能地推进工作。其次，我们应该提示每个 Agent 朝目标做出增量进展，同时在会话结束时将环境保持在一个干净的状态。所谓"干净状态"，是指适合合并到主分支的代码：**没有重大 bug，代码有序且文档齐全**，总体而言，开发者可以轻松开始新功能的开发，而无需先清理无关的混乱。

When experimenting internally, we addressed these problems using a two-part solution:

在内部实验中，我们通过一个两部分的方案解决了这些问题：

1. **Initializer agent**: The very first agent session uses a specialized prompt that asks the model to set up the initial environment: an `init.sh` script, a `claude-progress.txt` file that keeps a log of what agents have done, and an initial git commit that shows what files were added.

1. **初始化 Agent（Initializer agent）**：第一个 Agent 会话使用专门的提示词，要求模型搭建初始环境：一个 `init.sh` 脚本、一个用于记录各 Agent 工作日志的 `claude-progress.txt` 文件，以及一个展示新增文件的初始 git commit。

2. **Coding agent**: Every subsequent session asks the model to make incremental progress, then leave structured updates.

2. **编码 Agent（Coding agent）**：后续每个会话要求模型做出增量进展，然后留下结构化的更新记录。

The key insight here was finding a way for agents to quickly understand the state of work when starting with a fresh context window, which is accomplished with the `claude-progress.txt` file alongside the git history. **Inspiration for these practices came from knowing what effective software engineers do every day.**

这里的关键洞察在于，找到一种方式让 Agent 在以全新上下文窗口启动时能快速理解当前的工作状态——这通过 `claude-progress.txt` 文件配合 git 历史记录来实现。**这些实践的灵感来源于高效软件工程师每天的日常工作方式**。

## Environment Management

## 环境管理

**In the updated Claude 4 prompting guide**, we shared some best practices for multi-context window workflows, including a harness structure that uses "a different prompt for the very first context window." This "different prompt" requests that the initializer agent set up the environment with all the necessary context that future coding agents will need to work effectively. Here, we provide a deeper dive on some of the key components of such an environment.

**在更新后的 Claude 4 提示词指南中**，我们分享了一些多上下文窗口工作流的最佳实践，包括一种"在第一个上下文窗口中使用不同提示词"的 harness 结构。这个"不同的提示词"要求初始化 Agent 搭建好环境，准备好未来编码 Agent 高效工作所需的全部上下文。在此，我们将深入探讨这种环境的几个关键组成部分。

### Feature List

### 功能清单

To address the problem of the agent one-shotting an app or prematurely considering the project complete, we prompted the initializer agent to write a comprehensive file of feature requirements expanding on the user's initial prompt. In the claude.ai clone example, this meant over 200 features, such as "a user can open a new chat, type in a query, press enter, and see an AI response." **These features were all initially marked as "failing"** so that later coding agents would have a clear outline of what full functionality looked like.

为了解决 Agent 试图一次性完成整个应用、或过早认为项目已完成的问题，我们提示初始化 Agent 编写一份详尽的功能需求文件，对用户的初始提示词进行扩展。在 claude.ai 克隆项目的示例中，这意味着超过 200 项功能，例如"用户可以打开一个新对话，输入查询，按回车，然后看到 AI 的回复"。**这些功能最初全部标记为"未通过"**，以便后续的编码 Agent 能清晰了解完整功能的全貌。

```json
{
    "category": "functional",
    "description": "New chat button creates a fresh conversation",
    "steps": [
      "Navigate to main interface",
      "Click the 'New Chat' button",
      "Verify a new conversation is created",
      "Check that chat area shows welcome state",
      "Verify conversation appears in sidebar"
    ],
    "passes": false
  }
```

We prompt coding agents to edit this file only by changing the status of a `passes` field, and we use strongly-worded instructions like "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality." After some experimentation, we landed on using JSON for this, as **the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files**.

我们提示编码 Agent 在编辑该文件时，只能更改 `passes` 字段的状态，并使用措辞强硬的指令，例如"删除或修改测试是不可接受的，因为这可能导致功能缺失或出现 bug"。经过多次实验，我们最终选择了 JSON 格式，因为**模型不当修改或覆盖 JSON 文件的概率比 Markdown 文件要低得多**。

### Incremental Progress

### 增量推进

Given this initial environment scaffolding, the next iteration of the coding agent was then asked to work on only one feature at a time. **This incremental approach turned out to be critical to addressing the agent's tendency to do too much at once.**

在这套初始环境脚手架的基础上，下一轮迭代的编码 Agent 被要求每次只处理一个功能。**这种增量式方法对于解决 Agent 一次做太多事情的倾向至关重要。**

Once working incrementally, it's still essential that the model leaves the environment in a clean state after making a code change. In our experiments, we found that the best way to elicit this behavior was to ask the model to commit its progress to git with descriptive commit messages and to write summaries of its progress in a progress file. **This allowed the model to use git to revert bad code changes and recover working states of the code base.**

一旦开始增量工作，确保模型在每次代码变更后将环境保持在干净状态仍然非常关键。在实验中，我们发现引导这一行为的最佳方式是要求模型将进度提交到 git 并附带描述性的 commit 信息，同时在进度文件中写下工作总结。**这使得模型可以利用 git 回滚错误的代码变更，恢复到代码库的正常状态。**

These approaches also increased efficiency, as they eliminated the need for an agent to have to guess at what had happened and spend its time trying to get the basic app working again.

这些方法也提升了效率，因为它们消除了 Agent 不得不猜测之前发生了什么、然后花时间让基础应用重新跑起来的需要。

### Testing

### 测试

One final major failure mode that we observed was **Claude's tendency to mark a feature as complete without proper testing**. Absent explicit prompting, Claude tended to make code changes, and even do testing with unit tests or `curl` commands against a development server, but would fail recognize that the feature didn't work end-to-end.

我们观察到的最后一个主要失败模式是，**Claude 倾向于在没有充分测试的情况下就将功能标记为已完成**。在没有明确提示的情况下，Claude 通常会修改代码，甚至用单元测试或 `curl` 命令对开发服务器做测试，但无法识别该功能在端到端场景下其实并不可用。

In the case of building a web app, Claude mostly did well at verifying features end-to-end **once explicitly prompted to use browser automation tools and do all testing as a human user would**.

在构建 Web 应用的场景中，**一旦被明确提示使用浏览器自动化工具并像真实用户一样进行全部测试**，Claude 在端到端功能验证方面的表现大多不错。

![Claude 在测试 claude.ai 克隆项目时，通过 Puppeteer MCP 服务器截取的屏幕截图](https://img.riba2534.cn/images/2026/04/844ff9e7_699abec85402e.gif)

*[Screenshots taken by Claude through the Puppeteer MCP server as it tested the claude.ai clone.]*

*[Claude 在测试 claude.ai 克隆项目时，通过 Puppeteer MCP 服务器截取的屏幕截图。]*

Providing Claude with these kinds of testing tools dramatically improved performance, as **the agent was able to identify and fix bugs that weren't obvious from the code alone**.

为 Claude 提供这类测试工具显著提升了表现，因为 **Agent 能够发现并修复仅从代码层面无法察觉的 bug**。

Some issues remain, like limitations to Claude's vision and to browser automation tools making it difficult to identify every kind of bug. For example, Claude can't see browser-native alert modals through the Puppeteer MCP, and features relying on these modals tended to be buggier as a result.

一些问题仍然存在，例如 Claude 的视觉能力局限以及浏览器自动化工具的限制，使其难以识别所有类型的 bug。举例来说，Claude 无法通过 Puppeteer MCP 看到浏览器原生的 alert 弹窗，因此依赖这些弹窗的功能往往 bug 更多。

## Getting Up to Speed

## 进入状态

With all of the above in place, every coding agent is prompted to run through a series of steps to get its bearings, some quite basic but still helpful:

在完成上述所有准备工作后，每个编码 Agent 都会按照一系列步骤来熟悉环境。这些步骤有些相当基础，但依然很有帮助：

1. *Run `pwd` to see the directory you're working in. You'll only be able to edit files in this directory.*

1. *运行 `pwd` 查看当前工作目录。你只能编辑该目录下的文件。*

2. *Read the git logs and progress files **to get up to speed on what was recently worked on**.*

2. *阅读 git 日志和进度文件，**了解近期的工作内容**。*

3. *Read the features list file and choose the highest-priority feature that's not yet done to work on.*

3. *阅读功能清单文件，选择优先级最高且尚未完成的功能开始工作。*

This approach saves Claude some tokens in every session since it doesn't have to figure out how to test the code. It also helps **to ask the initializer agent to write an `init.sh` script that can run the development server**, and then run through a basic end-to-end test before implementing a new feature.

这种方式为 Claude 在每次会话中节省了一些 token，因为它不必自己摸索如何测试代码。此外，**让初始化 Agent 编写一个 `init.sh` 脚本来启动开发服务器**，并在实现新功能前先跑一遍基本的端到端测试，也很有帮助。

In the case of the claude.ai clone, this meant that the agent always started the local development server and used the Puppeteer MCP to start a new chat, send a message, and receive a response. This ensured that Claude could quickly identify if the app had been left in a broken state, and immediately fix any existing bugs. **If the agent had instead started implementing a new feature, it would likely make the problem worse.**

以 claude.ai 克隆项目为例，Agent 每次都会先启动本地开发服务器，然后通过 Puppeteer MCP 发起一轮新对话、发送消息并接收回复。这确保了 Claude 能快速发现应用是否处于异常状态，并立即修复已有的 bug。**如果 Agent 跳过这一步直接开始实现新功能，反而可能让问题雪上加霜。**

Given all this, a typical session starts off with the following assistant messages:

综合以上流程，一个典型的会话开头是这样的：

```
[Assistant] I'll start by getting my bearings and understanding the current state of the project.
[Tool Use] <bash - pwd>
[Tool Use] <read - claude-progress.txt>
[Tool Use] <read - feature_list.json>
[Assistant] Let me check the git log to see recent work.
[Tool Use] <bash - git log --oneline -20>
[Assistant] Now let me check if there's an init.sh script to restart the servers.
<Starts the development server>
[Assistant] Excellent! Now let me navigate to the application and verify that some fundamental features are still working.
<Tests basic functionality>
[Assistant] Based on my verification testing, I can see that the fundamental functionality is working well. The core chat features, theme switching, conversation loading, and error handling are all functioning correctly. Now let me review the tests.json file more comprehensively to understand what needs to be implemented next.
<Starts work on a new feature>
```

```
[Assistant] 我先来熟悉一下环境，了解项目的当前状态。
[Tool Use] <bash - pwd>
[Tool Use] <read - claude-progress.txt>
[Tool Use] <read - feature_list.json>
[Assistant] 让我看看 git 日志，了解最近的工作。
[Tool Use] <bash - git log --oneline -20>
[Assistant] 现在检查一下有没有 init.sh 脚本来重启服务器。
<启动开发服务器>
[Assistant] 很好！现在让我打开应用，验证一些核心功能是否正常运行。
<测试基本功能>
[Assistant] 根据验证测试的结果，核心功能运行良好。聊天核心功能、主题切换、对话加载和错误处理都工作正常。现在让我更全面地查看 tests.json 文件，了解接下来需要实现哪些功能。
<开始实现新功能>
```

## Agent Failure Modes and Solutions

## Agent 失败模式与解决方案

| Problem | Initializer Agent Behavior | Coding Agent Behavior |
|---------|---------------------------|----------------------|
| Claude declares victory on the entire project too early. | Set up a feature list file: based on the input spec, set up a structured JSON file with a list of end-to-end feature descriptions. | Read the feature list file at the beginning of a session. Choose a single feature to start working on. |
| Claude leaves the environment in a state with bugs or undocumented progress. | An initial git repo and progress notes file is written. | Start the session by reading the progress notes file and git commit logs, and run a basic test on the development server to catch any undocumented bugs. End the session by writing a git commit and progress update. |
| Claude marks features as done prematurely. | Set up a feature list file. | Self-verify all features. Only mark features as "passing" after careful testing. |
| Claude has to spend time figuring out how to run the app. | Write an `init.sh` script that can run the development server. | Start the session by reading `init.sh`. |

| 问题 | 初始化 Agent 的应对 | 编码 Agent 的应对 |
|------|---------------------|-------------------|
| Claude 过早宣布整个项目完成。 | 建立功能清单文件：基于输入规格，创建一个结构化的 JSON 文件，列出所有端到端的功能描述。 | 在每次会话开始时读取功能清单文件，选择一个功能开始工作。 |
| Claude 在退出时留下了 bug 或未记录的进展。 | 初始化一个 git 仓库并创建进度记录文件。 | 会话开始时读取进度记录文件和 git 提交日志，并在开发服务器上运行基本测试以捕获未记录的 bug。会话结束时提交一次 git commit 并更新进度记录。 |
| Claude 过早将功能标记为已完成。 | 建立功能清单文件。 | 自行验证所有功能。只有经过仔细测试后，才将功能标记为"通过"。 |
| Claude 需要花时间摸索如何运行应用。 | 编写一个 `init.sh` 脚本来启动开发服务器。 | 会话开始时先读取 `init.sh`。 |

## Future Work

## 未来工作

This research demonstrates one possible set of solutions in a long-running agent harness to enable the model to make incremental progress across many context windows. However, **there remain open questions**.

本研究展示了一种可行的方案——通过长时间运行的 Agent 框架，使模型能够跨多个上下文窗口实现增量式进展。然而，**仍有一些开放性问题有待探索**。

Most notably, it's still unclear whether a single, general-purpose coding agent performs best across contexts, or if better performance can be achieved through a multi-agent architecture. It seems reasonable that **specialized agents like a testing agent, a quality assurance agent, or a code cleanup agent, could do an even better job at sub-tasks across the software development lifecycle**.

其中最值得关注的是，目前尚不清楚单一的通用编码 Agent 在跨上下文场景中是否表现最佳，还是说通过多 Agent 架构能获得更好的效果。合理推测，**专门化的 Agent（如测试 Agent、质量保证 Agent 或代码清理 Agent）在软件开发生命周期的各个子任务上可能表现更出色。**

Additionally, this demo is optimized for full-stack web app development. A future direction is to generalize these findings to other fields. It's likely that some or all of these lessons can be applied to the types of long-running agentic tasks required in, for example, scientific research or financial modeling.

此外，本演示针对全栈 Web 应用开发进行了优化。未来的一个方向是将这些发现推广到其他领域。这些经验教训中的部分或全部，很可能也适用于科学研究或金融建模等场景中需要长时间运行的 Agent 任务。

## Acknowledgements

## 致谢

Written by Justin Young. Special thanks to David Hershey, Prithvi Rajasakeran, Jeremy Hadfield, Naia Bouscal, Michael Tingley, Jesse Mu, Jake Eaton, Marius Buleandara, Maggie Vo, Pedram Navid, Nadine Yasser, and Alex Notov for their contributions.

撰文：Justin Young。特别感谢 David Hershey、Prithvi Rajasakeran、Jeremy Hadfield、Naia Bouscal、Michael Tingley、Jesse Mu、Jake Eaton、Marius Buleandara、Maggie Vo、Pedram Navid、Nadine Yasser 和 Alex Notov 的贡献。

This work reflects the collective efforts of several teams across Anthropic who made it possible for Claude to safely do long-horizon autonomous software engineering, especially the code RL & Claude Code teams. Interested candidates who would like to contribute are welcome to apply at anthropic.com/careers.

本研究凝聚了 Anthropic 多个团队的共同努力，正是他们让 Claude 能够安全地完成长周期的自主软件工程任务，尤其要感谢 code RL 和 Claude Code 团队。有兴趣参与贡献的候选人，欢迎前往 anthropic.com/careers 申请。

---

## Footnotes

## 脚注

1. We refer to these as separate agents in this context only because they have different initial user prompts. The system prompt, set of tools, and overall agent harness was otherwise identical.

1. 我们在此语境中将它们称为不同的 Agent，仅仅是因为它们有不同的初始用户提示词（user prompt）。除此之外，系统提示词、工具集和整体 Agent 框架都是完全一致的。
