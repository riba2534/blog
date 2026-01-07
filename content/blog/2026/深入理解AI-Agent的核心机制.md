---
title: "深入理解 AI Agent 的核心机制：从循环到认知"
date: 2026-01-07T20:30:00+08:00
draft: false
featured_image: "https://image-1252109614.cos.ap-beijing.myqcloud.com/2026/01/07/695e76ab6b472.png"
description: "揭示 Claude Code、Cursor Agent 等编程代理的内在逻辑，通过代码一层层剖析其设计哲学"
tags:
- AI Agent
- Claude Code
- 大语言模型
- 编程助手
categories:
- AI
comment: true
---

# 深入理解 AI Agent 的核心机制：从循环到认知

> 揭示 Claude Code、Cursor Agent 等编程代理的内在逻辑，通过代码一层层剖析其设计哲学

---

## 引言：魔法背后的朴素真相

当我们惊叹于 Claude Code、Cursor Agent、Devin 这些 AI 编程助手的神奇能力时，常常会陷入一个误区——认为它们背后必然隐藏着某种复杂精密的架构：精心设计的状态机、复杂的规划算法、庞大的决策引擎……

但当我们剥去 CLI 的炫酷外观、花哨的进度条、严格的安全沙盒，**剩下的核心竟不到 100 行代码**。

这不是魔法，这是**循环**。

本文将带你从零开始，一行一行构建一个完整的 AI Agent，深入理解其设计哲学与实现细节。

---

## 一、范式转换：从被动应答到主动执行

### 两种交互模式的本质差异

理解 Agent 的第一步，是认清它与传统 AI 助手的根本区别。

**传统对话式 AI（Chatbot）**遵循请求-响应模式：

```
用户 → 模型 → 文本回复
```

模型接收输入，生成输出，任务结束。

**AI Agent（自主代理）**则是一个持续循环的控制系统：

```
用户 → 模型 → [工具调用 → 执行结果]* → 最终回复
                     ^________________|
```

注意那个 `*`（ Kleene 星号），它意味着**模型会反复调用工具**，每一次执行的结果都作为新的上下文反馈给模型，直到它判断任务完成。

### 从鹦鹉学舌到自主行动

这个星号代表着从"高级打字机"到"自主执行者"的质变：

| 对比维度 | 传统助手 | AI Agent |
|---------|---------|----------|
| 交互模式 | 单次请求-响应 | 持续循环 |
| 能力边界 | 仅限文本生成 | 可操作外部世界 |
| 决策主体 | 人类主导 | 模型主导 |
| 任务复杂度 | 低（单轮对话） | 高（多步规划） |

**核心洞见**：模型不再只是被动的回答者，而是成为了主动的决策者。代码的角色从"执行者"退居为"工具提供者"和"循环驱动者"。

---

## 二、最小可行实现：16 行代码的启示

让我们从最简版本开始，看看一个 Agent 究竟需要什么。

### 伪代码视角

```python
# 极简 Agent 循环
while True:
    response = model(messages, tools)
    if response.stop_reason != "tool_use":
        return response.text
    results = execute(response.tool_calls)
    messages.append(results)
```

这段代码浓缩了所有 Agent 的本质：**模型决定何时调用工具、调用哪些工具、调用顺序如何；代码只负责执行并反馈结果**。

### 可运行的最小实现

```python
from anthropic import Anthropic
import subprocess

client = Anthropic(api_key="your-api-key")

# 核心配置：一个工具 + 一个系统提示词
TOOLS = [{
    "name": "bash",
    "description": "执行 shell 命令",
    "input_schema": {
        "type": "object",
        "properties": {"command": {"type": "string"}},
        "required": ["command"]
    }
}]

def agent_loop(messages):
    while True:
        # 阶段 1：模型决策
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            messages=messages,
            tools=TOOLS
        )

        # 阶段 2：检查是否需要工具
        if response.stop_reason != "tool_use":
            return response.content

        # 阶段 3：执行工具并反馈
        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = subprocess.run(
                    block.input["command"],
                    shell=True,
                    capture_output=True,
                    text=True
                ).stdout
                results.append({
                    "type": "tool_result",
                    "name": block.name,
                    "tool_use_id": block.id,
                    "content": output
                })
        messages.append({"role": "user", "content": results})
```

### 为什么这个循环能工作？

1. **模型驱动循环**：循环的终止条件由模型决定（`stop_reason`），而非代码
2. **反馈驱动决策**：每次工具执行结果都进入模型上下文，影响下一步决策
3. **上下文累积**：消息历史自动保存，天然具备多轮对话能力

---

## 三、工具层设计：能力的边界与扩展

Bash 工具虽然理论上可以完成任何操作（通过调用其他命令），但**为特定场景设计专用工具**能显著提升模型的可用性和可靠性。

### 四个核心工具

经过实践验证，以下四个工具覆盖了 90% 的编程任务：

```python
TOOLS = [
    # 工具 1：Bash - 系统操作的网关
    {
        "name": "bash",
        "description": "执行 shell 命令：ls, find, grep, git, npm, python 等",
        "input_schema": {
            "type": "object",
            "properties": {"command": {"type": "string"}},
            "required": ["command"]
        }
    },

    # 工具 2：read_file - 理解代码的窗口
    {
        "name": "read_file",
        "description": "读取文件内容，支持限制行数以处理大文件",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "limit": {"type": "integer", "description": "最大读取行数"}
            },
            "required": ["path"]
        }
    },

    # 工具 3：write_file - 创建与重写
    {
        "name": "write_file",
        "description": "创建新文件或完全覆盖现有文件",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"}
            },
            "required": ["path", "content"]
        }
    },

    # 工具 4：edit_file - 精确手术式修改
    {
        "name": "edit_file",
        "description": "精确替换文件中的某段文本",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "old_text": {"type": "string"},
                "new_text": {"type": "string"}
            },
            "required": ["path", "old_text", "new_text"]
        }
    }
]
```

### 工具实现细节

```python
from pathlib import Path
import subprocess

WORKDIR = Path.cwd()

def safe_path(p: str) -> Path:
    """安全路径检查：防止路径逃逸工作目录"""
    path = (WORKDIR / p).resolve()
    if not path.is_relative_to(WORKDIR):
        raise ValueError(f"Path escapes workspace: {p}")
    return path

def run_bash(command: str) -> str:
    """执行 shell 命令，带超时和基本安全检查"""
    dangerous = ["rm -rf /", "sudo", "shutdown"]
    if any(d in command for d in dangerous):
        return "Error: Dangerous command blocked"

    result = subprocess.run(
        command,
        shell=True,
        cwd=WORKDIR,
        capture_output=True,
        text=True,
        timeout=60
    )
    return (result.stdout + result.stderr).strip()[:50000]

def run_read(path: str, limit: int = None) -> str:
    """读取文件内容，可选行数限制"""
    text = safe_path(path).read_text()
    if limit:
        lines = text.splitlines()[:limit]
        lines.append(f"... ({len(text.splitlines()) - limit} more lines)")
        return "\n".join(lines)
    return text

def run_write(path: str, content: str) -> str:
    """写入文件，自动创建父目录"""
    fp = safe_path(path)
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(content)
    return f"Wrote {len(content)} bytes to {path}"

def run_edit(path: str, old_text: str, new_text: str) -> str:
    """精确替换文本，只修改第一个匹配项"""
    fp = safe_path(path)
    content = fp.read_text()
    if old_text not in content:
        return f"Error: Text not found in {path}"
    new_content = content.replace(old_text, new_text, 1)
    fp.write_text(new_content)
    return f"Edited {path}"

def execute_tool(name: str, args: dict) -> str:
    """工具调用分派中心"""
    dispatch = {
        "bash": lambda a=args: run_bash(a["command"]),
        "read_file": lambda a=args: run_read(a["path"], a.get("limit")),
        "write_file": lambda a=args: run_write(a["path"], a["content"]),
        "edit_file": lambda a=args: run_edit(a["path"], a["old_text"], a["new_text"])
    }
    if name in dispatch:
        return dispatch[name]()
    return f"Unknown tool: {name}"
```

### 设计要点

1. **安全沙盒**：`safe_path` 确保模型无法访问工作目录外的文件
2. **输出截断**：防止长输出撑爆上下文窗口
3. **危险命令过滤**：阻止明显的破坏性操作
4. **精确匹配**：`edit_file` 使用精确字符串匹配，避免意外修改

---

## 四、系统提示词：Agent 的灵魂塑造

如果说工具是 Agent 的**四肢**，那么系统提示词就是 Agent 的**大脑**——它定义了 Agent 的行为模式、决策原则和输出风格。

```python
SYSTEM = f"""你是一个专业的编程助手，工作目录是 {WORKDIR}。

## 工作模式

遵循「思考 → 行动 → 报告」的循环：
1. 短暂思考下一步该做什么
2. 使用合适的工具执行
3. 报告结果并继续

## 核心原则

- **行动优先**：优先使用工具而非长篇解释
- **路径安全**：不确定文件路径时，先用 ls/find 查找
- **最小修改**：只做必要的改动，避免过度工程
- **可验证性**：完成后总结变更内容，让用户可以验证

## 能力边界

- 可以读取、创建、编辑文件
- 可以执行任何 shell 命令
- 不能访问工作目录之外的路径"""
```

### 提示词设计哲学

1. **简洁优先**：避免冗长的规则列表，模型难以处理过多约束
2. **模式引导**：用「思考 → 行动 → 报告」建立清晰的认知框架
3. **边界清晰**：明确能力范围和安全限制

---

## 五、完整的 Agent 循环

将所有组件组装起来，就是一个完整的 Agent：

```python
def agent_loop(messages: list) -> list:
    """
    完整的 Agent 循环实现

    核心模式：
        while True:
            response = model(messages, tools)
            if no tool calls: return
            execute tools, append results, continue
    """
    while True:
        # Step 1：模型决策阶段
        response = client.messages.create(
            model=MODEL,
            system=SYSTEM,
            messages=messages,
            tools=TOOLS,
            max_tokens=8000
        )

        # Step 2：解析响应，区分文本输出和工具调用
        tool_calls = []
        for block in response.content:
            if hasattr(block, "text"):
                print(block.text)  # 显示模型的思考过程
            if block.type == "tool_use":
                tool_calls.append(block)

        # Step 3：检查是否完成（无工具调用 = 任务结束）
        if response.stop_reason != "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            return messages

        # Step 4：执行所有工具调用
        results = []
        for tc in tool_calls:
            print(f"\n> {tc.name}: {tc.input}")  # 显示执行动作

            output = execute_tool(tc.name, tc.input)
            preview = output[:200] + "..." if len(output) > 200 else output
            print(f"  {preview}")  # 显示结果预览

            results.append({
                "type": "tool_result",
                "name": tc.name,
                "tool_use_id": tc.id,
                "content": output
            })

        # Step 5：将结果追加到对话历史，继续循环
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": results})
```

### 执行流程图解

{{<mermaid>}}
flowchart TD
    subgraph Agent_Loop ["Agent Loop"]
        A["user message"] --> B[client.messages.create<br/>model + tools + messages]
        B --> C{stop_reason?}
        C -- "tool_use" --> D[Execute Tools]
        C -- "stop" --> E[Return Result]
        D --> F[Append Results to History]
        F -->|Loop| B
    end

    style A fill:#e1f5fe
    style B fill:#fff3e0
    style C fill:#fce4ec
    style D fill:#e8f5e9
    style E fill:#e1f5fe
    style F fill:#f3e5f5
{{< /mermaid >}}

---

## 六、上下文隔离：子代理机制

当任务规模增大时，单一 Agent 会遇到一个严重问题：**上下文污染**。

### 问题的本质

考虑任务"探索代码库并重构认证模块"：

```
主 Agent 历史记录：
  [探索中] cat src/auth/user.py → 500 行
  [探索中] cat src/auth/session.py → 300 行
  ...
  [15 个文件后]
  [现在开始重构] "等等，user.py 里有什么来着？"
```

探索过程中的大量细节占用了宝贵的上下文空间，导致真正需要聚焦的重构任务反而没有足够的上下文容量。

### 解决方案：子代理

子代理机制通过**任务隔离**解决此问题：

```python
# 代理类型注册表：定义不同类型子代理的能力边界
AGENT_TYPES = {
    "explore": {
        "description": "只读代理，用于搜索和分析代码库",
        "tools": ["bash", "read_file"],  # 不能写入
        "prompt": "你是探索者。广泛搜索、深入分析，但绝不修改任何文件。返回结构化的简洁摘要。"
    },
    "code": {
        "description": "完整代理，用于实现功能",
        "tools": "*",  # 所有工具
        "prompt": "你是实现者。高效执行代码变更，遵循最佳实践，确保代码质量。"
    },
    "plan": {
        "description": "规划代理，用于设计实施方案",
        "tools": ["bash", "read_file"],  # 只读
        "prompt": "你是架构师。分析问题，设计清晰的实现步骤。输出编号列表，不要修改任何代码。"
    }
}

# Task 工具：触发子代理的核心
TASK_TOOL = {
    "name": "Task",
    "description": "为独立子任务生成专用子代理",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {"type": "string", "description": "简短的任务名"},
            "prompt": {"type": "string", "description": "详细指令"},
            "agent_type": {"type": "string", "enum": ["explore", "code", "plan"]}
        },
        "required": ["description", "prompt", "agent_type"]
    }
}
```

### 子代理执行引擎

```python
def run_task(description: str, prompt: str, agent_type: str) -> str:
    """
    执行子代理任务（隔离上下文版本）

    关键设计：
    1. 全新消息历史（不继承父上下文）
    2. 代理特化系统提示词
    3. 基于类型的工具过滤
    4. 只返回最终摘要
    """
    config = AGENT_TYPES[agent_type]

    # 构建子代理专用的系统提示词
    sub_system = f"""你是 {agent_type} 子代理。

{config["prompt"]}

完成任务后，返回清晰简洁的摘要。"""

    # 根据代理类型过滤可用工具
    sub_tools = get_tools_for_agent(agent_type)

    # 【关键】创建隔离的消息历史
    sub_messages = [{"role": "user", "content": prompt}]

    # 运行子代理循环（与主循环相同的模式）
    while True:
        response = client.messages.create(
            model=MODEL,
            system=sub_system,
            messages=sub_messages,
            tools=sub_tools,
            max_tokens=8000
        )

        if response.stop_reason != "tool_use":
            break

        # 执行工具调用
        tool_calls = [b for b in response.content if b.type == "tool_use"]
        results = []
        for tc in tool_calls:
            output = execute_tool(tc.name, tc.input)
            results.append({
                "type": "tool_result",
                "tool_use_id": tc.id,
                "content": output
            })

        # 追加到子代理历史
        sub_messages.append({"role": "assistant", "content": response.content})
        sub_messages.append({"role": "user", "content": results})

    # 只返回最终文本摘要
    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return "(子代理未返回文本)"
```

### 典型工作流程

```
用户: "把认证重构为 JWT"

主 Agent:
  │
  ├─► Task(explore): "找到所有认证相关文件"
  │     子代理（只读）读取 10 个文件
  │     返回: "认证模块位于 src/auth/，核心逻辑在 login.py"
  │
  ├─► Task(plan): "设计 JWT 迁移方案"
  │     子代理（只读）分析现有结构
  │     返回: "1. 添加 PyJWT 依赖 2. 创建 token 工具类 3. 更新登录逻辑"
  │
  ├─► Task(code): "实现 JWT tokens"
  │     子代理（完整权限）执行代码变更
  │     返回: "创建了 jwt_utils.py，更新了 login.py 和 middleware.py"
  │
  ▼
主 Agent 总结变更，响应用户
```

### 隔离的效果

| 对比项 | 单 Agent | 子代理 |
|-------|---------|-------|
| 上下文内容 | 探索过程污染主对话 | 主对话保持干净 |
| 任务聚焦度 | 低（信息过载） | 高（按任务隔离） |
| 可并行性 | 否 | 可并行探索多个方向 |
| 代码复杂度 | ~200 行 | ~450 行 |

---

## 七、知识外化：Skills 机制

如果说工具是 Agent 的**能力**，子代理是 Agent 的**组织方式**，那么 Skills 则是 Agent 的**知识**。

### 问题的演进

随着 Agent 应用场景扩展，出现了一个新挑战：**模型如何获取特定领域的专业知识？**

- 处理 PDF？需要知道 pdftotext、PyMuPDF 等工具
- 构建 MCP 服务器？需要理解协议规范
- 代码审查？需要一套系统化的检查清单

这些知识既不是通用能力（模型出厂时已具备），也不是工具（不执行操作），而是**领域专业知识**。

### 知识外化范式

传统方式下，模型知识只能通过训练更新：

```
修改模型行为 → 重新训练 → 部署新版本
成本：$10K-$1M+  时间：数周
```

Skills 机制引入了**知识外化**的新范式：

```
修改模型行为 → 编辑 SKILL.md → 即时生效
成本：$0  时间：5分钟
```

### SKILL.md 标准格式

```markdown
---
name: pdf
description: 处理 PDF 文件。用于读取、创建或合并 PDF。
---

# PDF 处理技能

## 读取 PDF

使用 pdftotext 快速提取文本：
```bash
pdftotext input.pdf -
```

使用 Python 和 PyMuPDF 提取并保留格式：
```python
import fitz  # PyMuPDF
doc = fitz.open("input.pdf")
for page in doc:
    text = page.get_text()
```

## 创建 PDF

使用 PyPDF2 合并多个文件：
```python
from PyPDF2 import PdfMerger
merger = PdfMerger()
merger.append("file1.pdf")
merger.append("file2.pdf")
merger.write("output.pdf")
```

## 注意事项

- 处理大文件时考虑分批处理
- 中文 PDF 可能需要指定字体路径
- 加密 PDF 需要先解密
```

### Skills 加载器实现

```python
import re
import yaml
from pathlib import Path

class SkillLoader:
    """从 SKILL.md 文件加载领域知识"""

    def __init__(self, skills_dir: Path):
        self.skills = {}
        self.load_skills(skills_dir)

    def parse_skill_md(self, path: Path) -> dict:
        """解析 YAML 前置元数据 + Markdown 正文"""
        content = path.read_text()
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)
        if not match:
            raise ValueError(f"Invalid SKILL.md format: {path}")

        metadata = yaml.safe_load(match.group(1))
        return {
            "name": metadata["name"],
            "description": metadata["description"],
            "body": match.group(2),
            "path": path,
            "dir": path.parent
        }

    def load_skills(self, skills_dir: Path):
        """加载所有 SKILL.md 文件"""
        for skill_md in skills_dir.glob("*/SKILL.md"):
            skill = self.parse_skill_md(skill_md)
            self.skills[skill["name"]] = skill

    def get_skill_content(self, name: str) -> str:
        """获取技能完整内容，用于注入上下文"""
        if name not in self.skills:
            return f"Skill '{name}' not found"

        skill = self.skills[name]
        return f"""<skill-loaded name="{name}">

{skill['body']}

</skill-loaded>

请按照上述技能指导完成任务。"""

    def list_skills(self) -> str:
        """生成系统提示词可用的技能索引"""
        if not self.skills:
            return "(no skills loaded)"
        return "\n".join(
            f"- {name}: {info['description']}"
            for name, info in self.skills.items()
        )
```

### 渐进式披露策略

Skills 采用**渐进式披露**优化上下文使用：

| 层级 | 内容 | Tokens 估算 | 加载时机 |
|-----|------|------------|---------|
| 元数据 | name + description | ~100 | 始终加载 |
| 主体 | 完整 SKILL.md | ~2000 | 触发时 |
| 资源 | scripts/, references/ | 无限制 | 按需 |

---

## 八、架构总览：全局视角

{{<mermaid>}}
flowchart TB
    subgraph Core ["Agent Core Loop"]
        direction TB
        Loop["while True:<br/>response = model(messages, tools)<br/>if stop_reason != 'tool_use': break<br/>execute tools<br/>append results"]
    end

    subgraph Tools ["Tools Layer"]
        bash["bash<br/>执行命令"]
        read["read_file<br/>读取代码"]
        write["write_file<br/>创建文件"]
        edit["edit_file<br/>修改代码"]
    end

    subgraph Advanced ["Advanced Features"]
        direction LR
        subgraph Subagent ["Subagent System"]
            Task["Task 工具"]
            explore["explore<br/>只读探索"]
            code["code<br/>完整实现"]
            plan["plan<br/>规划设计"]
            Task --> explore
            Task --> code
            Task --> plan
        end

        subgraph Skills ["Skills System"]
            SkillMD["SKILL.md 格式<br/>YAML + Markdown"]
            Loader["SkillLoader<br/>加载器"]
        end
    end

    Core --> Tools
    Core --> Advanced

    style Core fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Tools fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style Advanced fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style bash fill:#fff3e0,stroke:#ff9800
    style read fill:#fff3e0,stroke:#ff9800
    style write fill:#fff3e0,stroke:#ff9800
    style edit fill:#fff3e0,stroke:#ff9800
    style Subagent fill:#ffebee,stroke:#d32f2f
    style Skills fill:#e0f7fa,stroke:#0097a7
{{< /mermaid >}}

---

## 九、设计哲学：大道至简

回顾整个架构，我们能提炼出几条核心设计原则：

### 1. 极简核心

```
Agent = 循环 + 工具集合
```

没有状态机，没有复杂的规划模块，没有重框架。核心逻辑可以用一句话概括：**给模型工具，让它工作**。

### 2. 模型即决策者

模型负责：
- 判断何时使用工具
- 选择使用哪些工具
- 决定工具调用的顺序
- 判断任务何时完成

代码的角色被压缩到最小：提供工具定义、执行工具调用、管理循环。

### 3. 透明性优先

每个工具调用可见，每个结果可追溯。这种透明性带来：
- 易于调试
- 便于理解模型行为
- 支持人工干预

### 4. 渐进式复杂度

从 v0 到 v4，架构逐层演进：
- v0：1 个工具，递归自调用实现子代理
- v1：4 个核心工具，完整 Agent 循环
- v2：Todo 追踪，显式规划
- v3：子代理，上下文隔离
- v4：Skills，知识外化

每一步都建立在前一步之上，没有一步是"必须的"。

---

## 十、总结：本质与启示

Claude Code、Cursor Agent、Devin……这些看似复杂的系统，都共享同一个核心模式：

```python
while not done:
    response = model(conversation, tools)
    results = execute(response.tool_calls)
    conversation.append(results)
```

差异仅在于：
- **工具丰富度**：从单一 bash 到几十个专业工具
- **交互体验**：进度条、权限确认、错误恢复
- **安全边界**：沙盒、权限控制、危险操作拦截
- **知识储备**：从通用模型到加载领域 Skills

但**本质从未改变**：模型是决策者，代码是执行者，循环是骨架。

> **模型即代理。**

这就是全部的秘密。

---

## 延伸阅读

| 项目 | 描述 |
|-----|------|
| [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) | 渐进式 Agent 教程，从 50 行到 550 行 |
| [Kode CLI](https://github.com/shareAI-lab/Kode) | 开源完整 Agent CLI 实现 |
| [Agent Skills Spec](https://github.com/anthropics/agent-skills) | 官方 Skills 规范 |
| [Anthropic Tool Use](https://docs.anthropic.com/claude/docs/tool-use) | 官方工具使用文档 |
