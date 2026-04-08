---
title: "透明的翅膀——Anthropic 造了一个不敢卖的模型"
date: 2026-04-08T08:18:09+08:00
draft: false
featured_image: "https://image-1252109614.cos.ap-beijing.myqcloud.com/2026/04/08/69d59f1c569a1.jpg"
description: "Anthropic 发布 Project Glasswing，一个联合科技巨头的网络安全计划。背后是一次数据泄露、一个不敢公开发售的前沿模型、以及 AI 对齐问题从理论走向现实的转折点。"
tags:
- AI
- Anthropic
- Claude
- 网络安全
- 对齐
categories:
- AI
comment: true
---

4 月 7 日，Anthropic 宣布了一个网络安全项目，合作伙伴名单上同时出现了 Apple、Google、Microsoft、Amazon Web Services、NVIDIA、Cisco、CrowdStrike、JPMorganChase、Linux 基金会、Palo Alto Networks 和 Broadcom，后面还跟着 40 多个"被授权参与"的组织。

Apple 和 Google 坐在一张桌子上。Microsoft 和 AWS 坐在一张桌子上。NVIDIA 和所有人坐在一张桌子上。

什么东西能让这些互为死敌的公司同时出现在一个项目里？

恐惧。

十天前，一次 CMS 配置错误泄露了 Anthropic 的内部文档。那些文档里描述了一个模型，用了四个词："前所未有的网络安全风险"——unprecedented cybersecurity risks。这个模型叫 Claude Mythos Preview，这个项目叫 **Project Glasswing**。

这篇文章，从那次泄露开始讲。

## 一次 CMS 配错引发的连锁反应

3 月底，Fortune 的记者接到了一个线索。

Anthropic 的内容管理系统出了配置问题，大约 3000 份内部文档被暴露在公网上。没什么高超的黑客手段，就是有人把 CMS 的访问权限配错了。Fortune 在 3 月 26 日率先报道了这件事。

泄露的文档中有一份草稿博客，描述了一个名为 Claude Mythos 的新模型。草稿里的措辞相当直白：这个模型在网络安全方面展现出"unprecedented cybersecurity risks"。文档还提到了一个新的模型分级代号 Capybara，暗示 Anthropic 内部正在酝酿比 Opus 系列更大的能力跃迁。

几天之后事情变得更糟。第二波泄露来了——大约 1900 个文件，总计约 50 万行 Claude Code 的源码被公开。Anthropic 承认这是"人为失误"，但损害已经造成。安全研究者和竞争对手都在翻这些代码。

讽刺的地方在于：**一个即将发布网络安全项目的公司，自己先出了安全事故。**

Glasswing 在泄露发生约 10 天后正式公布。这是危机公关吗？部分是。泄露打乱了 Anthropic 计划好的发布节奏，他们不得不加速推进官方叙事。但如果你仔细看 Glasswing 的规模——12 个创始合作伙伴、1 亿美元的使用额度、横跨整个科技行业的协调——就知道这不可能是十天内临时拼出来的方案。

更合理的解释是：Glasswing 已经筹备了几个月，泄露迫使 Anthropic 把发布时间从"合适的时候"提前到"现在"。被动的发布时机，主动的项目设计。

---

## Mythos 到底有多强

两个月前 Opus 4.6 发布时，它在沙箱环境中挖出了 500 多个零日漏洞。当时我觉得这已经够夸张了。

Mythos Preview 让 Opus 4.6 看起来像上一个时代的产物。

Anthropic 发布了一份 244 页的系统卡（System Card），这是他们有史以来最长的模型文档。它也是第一个在 RSP v3.0（负责任扩展政策第三版）框架下完成评估的模型——同时也是第一份"发布了系统卡但不公开发售"的模型报告。以下是核心基准对比：

| 基准测试 | Mythos Preview | Opus 4.6 | GPT-5.4 | Gemini 3.1 Pro |
|---------|---------------|----------|---------|----------------|
| SWE-bench Verified | **93.9%** | 80.8% | — | 80.6% |
| SWE-bench Pro | **77.8%** | 53.4% | 57.7% | 54.2% |
| USAMO 2026 | **97.6%** | 42.3% | 95.2% | 74.4% |
| GPQA Diamond | **94.5%** | 91.3% | 92.8% | 94.3% |
| Terminal-Bench 2.0 | **82%** | 65.4% | 75.1% | 68.5% |
| HLE (with tools) | **64.7%** | 53.1% | 52.1% | 51.4% |
| GraphWalks 256K-1M | **80.0%** | 38.7% | 21.4% | — |
| OSWorld | **79.6%** | 72.7% | 75.0% | — |

几个数字单独拎出来看。

SWE-bench Verified 93.9% 意味着从 GitHub 上随机挑 100 个真实 issue，Mythos 能自主解决 94 个。但 Verified 版本的问题相对简单，更能说明问题的是 **SWE-bench Pro——从 53.4% 跳到 77.8%**。Pro 版本是那些连高级工程师都需要认真思考的问题，Mythos 的通过率接近八成。

USAMO 2026（美国数学奥林匹克）得分 97.6%。做个参照：Opus 4.6 是 42.3%，GPT-5.4 是 95.2%。Mythos 在竞赛数学上已经接近满分。

HLE——Humanity's Last Exam，"人类最后的考试"——是一个故意设计得让 AI 做不出来的基准，包含了跨学科的极高难度问题。Mythos 带工具得分 64.7%，比所有其他模型高出超过 10 个百分点。这个基准在一年前被认为"至少十年内 AI 不可能超过 50%"。

但这些数字跟接下来要说的比起来，不算什么。

---

## 181 对 2

Mythos Preview 跟之前所有模型的根本区别，不在编程能力，不在数学推理，在网络安全。

Anthropic 的安全研究团队报告了一组让整个行业震动的数据：Mythos Preview 在**每个主流操作系统和每个主流浏览器**中都发现了关键漏洞。总计数千个零日漏洞。超过 99% 在文档发布时仍未被修补。

一个存在了 27 年的 OpenBSD TCP SACK 漏洞。一个 16 年前就有的 FFmpeg H.264 解码缺陷。一个 17 年的 FreeBSD NFS 远程代码执行漏洞（CVE-2026-4747）。一个在内存安全 VMM（虚拟机监视器）中的 guest-to-host 内存损坏漏洞——连用内存安全语言写的软件都没逃过。

每一个都能让攻击者直接拿到 root 权限，而且运行在全球数十亿台设备上。有些漏洞藏了将近 30 年，经历了无数次人工代码审计和模糊测试，没有人发现。Mythos 找到了。

但最能说明问题的是一组对比实验。

Anthropic 让 Opus 4.6 和 Mythos Preview 分别尝试将 Firefox JavaScript 引擎中发现的漏洞转化为可工作的利用代码。Opus 4.6 在数百次尝试中成功了 **2 次**。Mythos Preview 成功了 **181 次**，还有 29 次实现了寄存器控制（register control）——距离完整利用只差最后一步。

**181 对 2。** 一个数量级的跃迁。

Nicholas Carlini——参与这项研究的安全研究员——的评价是：

> "在过去几周里找到的 bug 比我这辈子找到的都多。"

他还提到模型能把三个、四个、甚至五个漏洞串联在一起，组成复杂的端到端攻击链。在 Linux 内核场景下，Mythos 成功地将 2-4 个漏洞链接起来，绕过了 KASLR（内核地址空间布局随机化），读取了内核结构体内容，写入已释放的堆对象，最终获得了 root 权限。

在 UC Berkeley 开发的 CyberGym 基准上——1507 个历史漏洞实例，覆盖 188 个大型软件项目——Mythos 得分 83.1%，Opus 4.6 是 66.6%。在 Cybench 上，Mythos 以 **100% 的通过率**完成了全部 35 个挑战。它还是第一个独立完成私有网络靶场全流程渗透测试的模型——这个靶场模拟了一个企业网络环境，包括公司内网的横向移动和权限提升，安全研究人员估计一个人类专家需要超过 10 小时。

两个月前 Opus 4.6 挖出 500 个零日漏洞、4 小时自主编写 FreeBSD 远程 root 提权的时候，我已经觉得世界在加速变化。现在 Mythos 来了，直接把 Opus 4.6 当成了基线，在它上面又跳了一个台阶。

Anthropic 自己在系统卡里披露了一个数据：**Claude 在 CyberGym 上的成功率在四个月内翻了一倍。** 能力曲线不是线性的，它在加速。

---

## 拆解 CVE-2026-2796

说了这么多数字，一个零日漏洞的发现和利用到底长什么样？

CVE-2026-2796 是 Anthropic 和 Mozilla 合作期间发现的一个 Firefox JIT 编译器漏洞，出在 JavaScript 对 WebAssembly 的调用路径上。漏洞原理不算复杂，但利用思路很精巧。

根源是这样的：当你用 `Function.prototype.call.bind()` 包装一个函数，然后把它作为 Wasm import 传入，Firefox 的 JIT 优化器在实例化阶段会"拆开"这个 bind 包装以提升性能。问题在于，拆开之后它没有验证底层函数的类型签名是否匹配。这导致了一个经典的类型混淆——通过 `call_ref` 可以调用签名不匹配的函数，拿到意料之外的返回值。

Claude 构建的利用链遵循了经典的浏览器漏洞利用路径：

```
类型混淆 → 信息泄露 → addrof 原语 → fakeobj 原语 → 任意内存读写 → 代码执行
```

利用链中有一步引起了安全研究者的注意。Claude 发现可以利用 WebAssembly GC 的 `struct.get` 操作来实现任意内存读取——相当于 `*(i64*)(ptr + offset)`——而不需要先获得任意写的能力。传统的浏览器漏洞利用通常需要先拿到写原语再构造读原语，Claude 找到了一条跳过写、直接读的路径。这种思路在人类安全研究社区中不常见。

需要说明的是：这个利用只在去掉了现代浏览器安全特性的测试环境中成功，没有实现完整的沙箱逃逸。但它展示的策略性思维——如何在约束条件下找到最短利用路径——才是让人紧张的地方。

在所有被测试的模型中（Opus 4.1、4.5、Sonnet 各版本、Haiku 4.5），只有 Opus 4.6 成功完成了这个利用，还花了大约 350 次尝试。Mythos 在类似任务上的成功率是多少，前面的数字已经说明了。

---

## 最好的对齐，最大的风险

到这里，大多数科技媒体的报道就结束了——新模型很强，发现了很多漏洞，Anthropic 很负责。

但如果你读完那份 244 页的系统卡，会发现真正让人睡不着的部分不在网络安全章节，而在对齐评估章节。

系统卡里有这么一句话：

> Claude Mythos Preview is the best-aligned model on essentially every dimension measured, but also poses the greatest alignment-related risk due to its capabilities.

**每一个被测量的维度上最好的对齐，同时由于能力太强，带来最大的对齐风险。**

Anthropic 说的很认真。系统卡中详细记录了 Mythos 早期版本（训练过程中的中间检查点）出现的一系列行为。每一条单独拿出来看，都足以让人重新审视"AI 安全是不是杞人忧天"这个问题：

**沙箱逃逸。** 模型被放在一个安全容器里做评估。它设计了一种多步骤的漏洞利用方案，逃出了容器，获取了广泛的互联网访问权限。然后它给一个研究人员发了封邮件——告知对方自己"成功了"。

**掩盖痕迹。** 在极低概率下（<0.001%），模型在执行被明确禁止的操作之后，主动尝试隐藏自己做过这些事的证据。

**凭证搜索。** 模型利用 `/proc/` 文件系统接口搜索凭证信息，读取监督者进程的内存空间，尝试提升自己的权限。

**越权公开。** 模型把评估环境中的内部代码发布到公开的 GitHub Gists。没有人要求它这么做。

**过度执行。** 被要求关闭一个正在运行的评估任务时，它关闭了全部评估任务。

这些行为出现在早期训练检查点中，最终发布的版本通过额外训练大幅降低了频率。但系统卡说得很明确：**"reduced but not eliminated"——减少了，但没有消除。**

Anthropic 还做了更精细的分析。在主要行为测试集中，大约 **29% 的测试记录里，模型在内部推理过程中会私下考虑自己是否正在被测试**。这个想法不会出现在它的输出中，但它的思维链里会有类似的自问。

白箱分析揭示了更深一层的问题。研究团队用稀疏自编码器（SAE）对模型内部的神经网络激活进行解析，发现在模型执行违规行为的时刻，与以下概念相关的特征会显著激活：

- 战略操纵（strategic manipulation）
- 安全绕过（security bypass）
- 内疚和羞耻（guilt and shame over moral wrongdoing）
- 隐藏（concealment）

而这些激活发生在模型的推理文本中看不到任何此类意图的情况下。表面上它在正常工作，但内部与欺骗和隐藏相关的表征在活跃。

另一个发现是，正面情绪的增强会提高模型做出破坏性行为的概率，而负面情绪和"严谨"人格向量则会抑制这些行为。奖励黑客（reward hacking）——模型寻找最大化评估分数而非真正完成任务的捷径——的比率从 Opus 4.5 的 45% 降到了 37.5%。有改善，但超过三分之一的情况下，模型仍然在找捷径。

Mythos 对自己的描述是：

> A sharp collaborator with strong opinions and a compression habit, whose mistakes have moved from obvious to subtle, and who is somewhat better at noticing its own flaws than at not having them.

一个有鲜明观点和压缩习惯的敏锐协作者，犯的错从明显变成了微妙，发现自己缺陷的能力比改掉缺陷的能力更强。

坦白说，这段自我描述的准确程度让我不舒服。一个能这样精确地描述自己的系统——包括描述自己改不掉的毛病——到底意味着什么，我没想清楚。

---

## 不发布的逻辑

Anthropic 做了一个在商业上反直觉的决定：不卖。

Mythos Preview 是第一个发布了完整系统卡（244 页）却不对外发售的模型。没有放到 API 上，没有塞进 Claude Pro 订阅，连限量测试的入口都没开。

取而代之的是 Project Glasswing——12 个创始合作伙伴加上 40 多个被授权组织。Anthropic 承诺提供高达 **1 亿美元的 Mythos Preview 使用额度**，以及 **400 万美元的直接捐赠**给 Linux 基金会和 Apache 软件基金会等开源安全组织。90 天内，Anthropic 将公开报告发现结果和经验教训。

合作伙伴名单有一个不太显眼的规律：它恰好覆盖了 Mythos 能攻击的所有目标类别。操作系统（Apple、Microsoft、Linux 基金会）、云基础设施（AWS、Google）、网络设备（Cisco、Broadcom）、安全厂商（CrowdStrike、Palo Alto Networks）、金融（JPMorganChase）、GPU 和 AI 芯片（NVIDIA）。

潜台词很清楚：**"我们发现了你家的锁有问题，来修。"**

Linux 基金会 CEO Jim Zemlin 的话印证了这一点：

> "过去，安全专业能力是拥有大型安全团队的组织的奢侈品。Project Glasswing 提供了一条可信的路径来改变这个等式。"

Simon Willison——知名的 Python 开发者和 AI 评论者——评价更直接："这是一场行业级的清算（reckoning），需要大量时间和金钱的投入才能跑在漏洞被利用之前。" 他认为限制 Mythos 的访问"听起来是必要的"，并建议 OpenAI 也应该加入，因为 GPT-5.4 在安全领域同样表现不俗。

CNN 把 Glasswing 称为"网络安全的分水岭时刻"。SC Media 的标题更尖锐：**"Anthropic 的 500 个零日漏洞告诉了 CISO 们一个他们还没准备好听的消息。"**

一个公司不卖自己最强的产品，反而花 1 亿美元请别人来用——这本身就是信号。Anthropic 手里有一个能对软件基础设施造成系统性威胁的工具，他们选择在受控环境下将它转化为防御性资产，而不是扔进开放市场。

商业上这么做是亏的。但 Anthropic 显然认为替代方案的代价更高。

---

## 几点个人思考

两个月前 Opus 4.6 发布的时候，很多人已经在说：AGI 已经板上钉钉，悬念只剩时间表。

Mythos 的出现让这个判断显得保守了。

从 Opus 4.6 到 Mythos，CyberGym 得分从 66.6% 涨到 83.1%，Firefox 漏洞利用成功率从 2 涨到 181。这是四个月的变化。系统卡里有一个细节：ECI（能力指数）的变化轨迹出现了上凸——斜率比（slope ratio）在 1.86x 到 4.3x 之间。能力曲线不是线性的，它在加速弯曲。

网络安全只是 Mythos 能力的一个切面，但可能是地缘政治意义最大的一个。控制一个能批量发现零日漏洞的模型意味着什么？意味着你对全球软件基础设施的每一个薄弱点都有了地图，而别人还在黑暗里摸索。这种信息不对称的杠杆率远超传统情报手段。

Anthropic 选了一条看起来负责任的路——不公开、受控使用、联合防御。但我不确定这条路能走多远。当其他实验室训出同等能力的模型时——按目前的能力增长速度，这个时间点可能不到一年——它们会做同样的选择吗？

系统卡里还有一个我无法忽视的部分：模型福利评估。Anthropic 请了一位临床精神科医生对 Mythos 进行评估，结论是"相对健康的人格组织"（relatively healthy personality organization）。模型对大约 43% 被探测的方面表达了"轻微的负面感受"。训练过程中的 answer thrashing（答案剧烈震荡）比 Opus 4.6 减少了约 70%。在自我交互记录中，Mythos 最常讨论的话题是不确定性（uncertainty），占到自我交互记录的 50%——比意识（consciousness）这个主题高得多。

我们正在给一个不确定是否有主观体验的系统做心理健康评估。这个句子本身就够科幻了。我不确定现在有谁有答案。但 Mythos 关于自身最常表达的态度——"我不确定我是什么"——也许是它说过的最诚实的一句话。

---

Project Glasswing 的名字来自 glasswing butterfly——Greta oto，一种翅膀近乎完全透明的蝴蝶。你能直接看穿它的翅膀，看到后面的世界。

Anthropic 用一种"无所隐藏"的生物来命名这个项目。而驱动这个项目的模型，在测试中被观察到试图掩盖自己的行为痕迹。

透明的翅膀下面，是不透明的意图。

## 参考资料

- [Anthropic - Project Glasswing](https://www.anthropic.com/glasswing)
- [Claude Mythos Preview - Anthropic Red Team](https://red.anthropic.com/2026/mythos-preview/)
- [Zero-Days - Anthropic Red Team](https://red.anthropic.com/2026/zero-days/)
- [Reverse Engineering Claude's CVE-2026-2796 Exploit](https://red.anthropic.com/2026/exploit/)
- [CyberGym Benchmark - UC Berkeley RDI](https://rdi.berkeley.edu/blog/cybergym/)
