# GitHub Copilot CLI 与 GitHub Copilot SDK 实战指南

本文基于 GitHub 官方文档与 `github/copilot-sdk` 仓库整理，重点放在**怎么上手、怎么集成、怎么落地**。

---

## 1. 先搞清楚两者分别是什么

### GitHub Copilot CLI

Copilot CLI 是把 Copilot 直接带进终端里的交互式智能体。它适合：

- 直接在代码仓库里改文件、跑命令、查 GitHub 资源
- 做调试、重构、提交、生成 PR
- 先讨论方案，再让 Copilot 动手

它有两个核心使用方式：

- **交互式**：输入 `copilot` 后持续对话
- **程序化**：用 `copilot -p "..."` 一次性执行任务后退出

### GitHub Copilot SDK

Copilot SDK 是把 Copilot 的智能体能力嵌进你自己的应用里。它适合：

- 给你的产品加一个“Copilot 驱动”的助手
- 在应用内部调用 Copilot 处理用户任务
- 自己掌控会话、流式输出、hooks、MCP、子 agent、持久化等能力

它的定位更像“**把 Copilot 变成你应用的后端智能层**”。

---

## 2. 一句话对比

| 维度 | Copilot CLI | Copilot SDK |
| --- | --- | --- |
| 面向对象 | 开发者本人 | 你的应用/服务 |
| 入口 | 终端 | 代码调用 |
| 主要用途 | 交互式改代码、运维、GitHub 操作 | 把 Copilot 能力集成到产品里 |
| 常见场景 | 修 bug、生成 PR、总结变更、跑命令 | 构建 AI 助手、工作流自动化、内部工具 |
| 扩展方式 | custom instructions / agents / skills / MCP / LSP | hooks / custom agents / skills / MCP / streaming / persistence |
| 运行方式 | 交互式或单次 prompt | 通过语言 SDK 调用 CLI server |

---

## 3. GitHub Copilot CLI 实战

### 3.1 安装与启动

官方支持 Linux、macOS、Windows。常见安装方式：

```bash
curl -fsSL https://gh.io/copilot-install | bash
```

或者：

```bash
brew install copilot-cli
```

Windows 也可以用：

```powershell
winget install GitHub.Copilot
```

安装后直接运行：

```bash
copilot
```

第一次启动通常会让你：

1. 确认当前目录是否可信
2. 登录 GitHub
3. 选择模型

### 3.2 最常见的工作流

#### 直接问一个问题

```text
Explain the auth flow in this repo
```

#### 让它改代码

```text
Refactor the payment service to extract validation into a helper
```

#### 让它帮你做 Git 操作

```text
Commit the current changes with a clear message
```

#### 让它查 GitHub 资源

```text
List my open PRs in this repository
```

### 3.3 计划模式：复杂任务先规划

按 `Shift+Tab` 可以在模式之间切换。**计划模式**适合：

- 多文件改动
- 需求还不完全明确
- 想先让 Copilot 生成实施方案，再动手

实战建议：

- 先让它梳理范围
- 再补充约束
- 确认方案后再执行

这比一上来直接改代码更稳。

### 3.4 程序化调用：一次性执行

如果你想把 Copilot 当成脚本工具用，可以直接传 prompt：

```bash
copilot -p "Summarize the last 10 commits" --allow-tool='shell(git log)'
```

适合：

- CI 辅助
- 一次性的自动化任务
- 生成摘要、报告、迁移建议

### 3.5 交互中最有用的命令

这些命令几乎是日常必备：

- `/model`：切换模型
- `/plan`：进入计划模式
- `/lsp`：查看语言服务状态
- `/context`：看上下文窗口占用
- `/compact`：压缩会话历史
- `/resume`：恢复会话
- `/allow-all`：允许更多工具
- `/feedback`：提交反馈
- `/mcp`：管理 MCP server

### 3.6 可信目录与工具授权

Copilot CLI 会在你启动的目录及其子目录中工作，所以一定要理解这两个概念：

- **trusted directories**：Copilot 被允许读写执行的范围
- **allowed tools**：Copilot 被允许调用的命令/工具

实战建议：

- 只在你信任的仓库里启动
- 不要把整个 home 目录当工作目录
- 对破坏性命令保持谨慎，尤其是 `rm`、`git push`、`sed`、`chmod`

可用的授权思路：

```bash
copilot --allow-tool='shell(git)' --deny-tool='shell(rm)'
```

如果你要更自动化一点：

```bash
copilot -p "Revert the last commit" --allow-all-tools
```

但自动放权一定要在隔离环境里用。

### 3.7 自定义：让 Copilot 更像“你的团队”

#### 3.7.1 Custom instructions

适合放“几乎每次都要遵守”的规则，比如：

- 代码风格
- 测试命令
- 提交习惯
- 项目架构约定

常见位置：

- `.github/copilot-instructions.md`
- `.github/instructions/**/*.instructions.md`
- `AGENTS.md`

示例：

```md
# 项目约定

- 所有 TypeScript 变更都要补测试
- 先查现有工具函数，避免重复实现
- 修改 API 前先确认破坏性兼容问题
```

#### 3.7.2 Custom agents

适合把任务分工成不同“专家”：

- 前端 agent
- 测试 agent
- 发布 agent
- 代码审查 agent

使用方式：

- 在 CLI 里选 `/agent`
- 在 prompt 里直接点名 agent
- 用 `--agent=...` 指定

#### 3.7.3 Skills

Skill 适合放“专项任务包”，包含：

- `SKILL.md`
- 脚本
- 参考资料

适合场景：

- 特定代码生成规范
- 复杂操作手册
- 团队内部流程

#### 3.7.4 MCP server

Copilot CLI 自带 GitHub MCP server，也可以加你自己的 MCP server，让 Copilot 访问外部系统，比如：

- Jira / Notion
- Sentry
- 内部 API
- 云平台

实战思路：

1. 先加只读工具
2. 再逐步放开写操作
3. 对敏感工具保持显式授权

#### 3.7.5 LSP

Copilot CLI 支持语言服务，可以增强：

- go-to-definition
- hover
- diagnostics

如果你在大仓库里做代码理解，LSP 会很有帮助。

### 3.8 适合 Copilot CLI 的真实任务

建议优先拿它做这些事：

- 重构一个函数或模块
- 总结一个 PR 或提交历史
- 生成测试
- 排查失败的构建
- 帮你执行 GitHub 操作
- 边问边改一个功能

不太建议一开始就让它做：

- 大范围危险重命名
- 需要非常精细人工判断的安全操作
- 不明确边界的全仓库自动修改

---

## 4. GitHub Copilot SDK 实战

### 4.1 适合什么场景

Copilot SDK 适合做“**你自己的 Copilot 产品**”：

- 企业内部知识助手
- 工单/PR/Issue 自动处理工具
- 带 AI 的开发者平台
- 多 agent 工作流编排

官方仓库说明它是 **public preview**，所以适合开发和试点，生产环境要谨慎评估。

### 4.2 安装思路

官方 quickstart 里，Node.js 路线要求 **Node.js 18+**。

官方 SDK 覆盖：

- Node.js / TypeScript
- Python
- Go
- .NET
- Java

官方仓库里给出的典型安装方式：

```bash
npm install @github/copilot-sdk
pip install github-copilot-sdk
go get github.com/github/copilot-sdk/go
dotnet add package GitHub.Copilot.SDK
```

### 4.3 先搞定认证

SDK 认证方式很多，常见有：

- 使用本机已登录的 Copilot CLI
- GitHub OAuth
- 环境变量 token
- BYOK（你自己的模型/密钥）
- Azure Managed Identity（特定场景）

最简单的路径通常是：

1. 先装并登录 Copilot CLI
2. 再让 SDK 复用 CLI 的登录态

也就是说，CLI 常常是 SDK 最省事的“认证底座”。

### 4.4 Node/TypeScript 版最小可用示例

```ts
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const response = await session.sendAndWait({ prompt: "What is 2 + 2?" });
console.log(response?.data.content);

await client.stop();
process.exit(0);
```

这个例子里最重要的三个概念是：

- `CopilotClient()`：管理与 Copilot CLI 的连接
- `createSession()`：创建会话并选择模型
- `sendAndWait()`：发消息并等待完整响应

### 4.5 流式输出

如果你想做“边生成边显示”的体验，开 streaming：

```ts
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
});

session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});

session.on("session.idle", () => {
  console.log();
});

await session.sendAndWait({ prompt: "Tell me a short joke" });
await client.stop();
```

适合：

- WebSocket / SSE 风格 UI
- CLI 工具
- 长回复场景

### 4.6 事件订阅

SDK 支持事件监听，适合做日志、状态更新、审计：

```ts
const unsubscribeAll = session.on((event) => {
  console.log("Event:", event.type);
});

const unsubscribeIdle = session.on("session.idle", () => {
  console.log("Session is idle");
});

unsubscribeAll();
unsubscribeIdle();
```

### 4.7 Hooks：真正的“可编排能力”

SDK 的 hooks 很适合做企业级定制：

- `onPreToolUse`：工具执行前拦截或改参数
- `onPostToolUse`：工具执行后加工结果
- `onUserPromptSubmitted`：用户输入前处理
- `onSessionStart` / `onSessionEnd`：会话生命周期管理
- `onErrorOccurred`：统一错误处理

实战例子：

- 给每次工具调用打日志
- 对危险工具做二次确认
- 自动注入项目上下文
- 统一做失败重试和告警

### 4.8 Custom agents、skills、MCP

SDK 也不是只能“问答”：

- **custom agents**：把不同角色拆成不同子 agent
- **skills**：复用任务型能力包
- **MCP servers**：接入外部工具和数据源

这意味着你可以做：

- 连接 Jira、GitHub、Sentry、Notion 等外部系统
- 让 Copilot 调用你的内部 API
- 为不同任务配置不同专长 agent

### 4.9 会话持久化与队列

SDK 还支持：

- 暂停/恢复 session
- 发送 steering 消息
- 队列化后续消息

这很适合：

- 后台 worker
- 长任务流程
- 需要跨重启恢复状态的系统

### 4.10 图像输入

如果你的产品需要让 Copilot 看图，SDK 也支持把图片作为附件发送到会话里。

典型场景：

- UI 截图分析
- 设计稿解读
- 错误截图诊断

### 4.11 BYOK：让 CLI / SDK 使用外部模型

BYOK（Bring Your Own Key）表示：**不用 GitHub 托管模型，而是改用你自己的模型提供商和 API key**。官方支持的方向主要有：

- `openai`：OpenAI、Ollama、vLLM、Foundry Local、以及其他 OpenAI 兼容端点
- `azure`：Azure OpenAI / Azure AI Foundry
- `anthropic`：Anthropic Claude

#### 4.11.1 你会得到什么

- 可以用你自己的计费和模型供应商
- 可以接本地模型或私有云模型
- 可以在受限网络、企业环境、甚至离线环境里使用 Copilot CLI
- 可以让 SDK 调用你指定的模型端点

#### 4.11.2 模型要求

不管是 CLI 还是 SDK，BYOK 模型都必须支持：

- **tool calling / function calling**
- **streaming**

官方还建议模型有 **128k 以上上下文窗口**，否则大仓库任务体验会明显下降。

#### 4.11.3 Copilot CLI 如何接入其他模型

CLI 的方式最直接：在启动 `copilot` 之前先设置环境变量。

**OpenAI 兼容端点（含 Ollama、vLLM、Foundry Local 等）**

```bash
export COPILOT_PROVIDER_BASE_URL=http://localhost:11434
export COPILOT_MODEL=llama3.2
copilot
```

这类配置的核心原则是：**只要你的服务暴露的是 OpenAI-compatible API，Copilot CLI 就能把它当成 provider 使用**。如果你用的是 DeepSeek、Qwen、vLLM、LiteLLM、自建网关，思路都一样：把 `COPILOT_PROVIDER_BASE_URL` 指向你的端点，把 `COPILOT_MODEL` 指向你实际可用的模型名。

**DeepSeek 示例**

```bash
export COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
export COPILOT_PROVIDER_API_KEY=sk-f827bd10f50a49a89884c740b0dae8f2
export COPILOT_MODEL=deepseek-chat
copilot
```

如果你想用 DeepSeek 的推理模型，一般把 `COPILOT_MODEL` 换成对应的模型名即可，例如 `deepseek-reasoner`（前提是你账号和接口确实开放了这个模型）。

**Qwen 示例**

如果你使用的是 Qwen / DashScope 的 OpenAI-compatible 入口，整体写法也是一样的：

```bash
export COPILOT_PROVIDER_BASE_URL=YOUR_QWEN_OPENAI_COMPATIBLE_BASE_URL
export COPILOT_PROVIDER_API_KEY=YOUR_QWEN_API_KEY
export COPILOT_PROVIDER_TYPE=openai
export COPILOT_MODEL=YOUR_QWEN_MODEL_NAME
copilot
```

对于 Qwen，最重要的是确认你拿到的是**OpenAI-compatible 端点**，因为 Copilot CLI 需要的是这种“像 OpenAI 一样”的接口，而不是任意 REST API。只要你的 Qwen 服务满足这一点，接法就和 OpenAI 一样。

如果是远程 OpenAI：

```bash
export COPILOT_PROVIDER_BASE_URL=https://api.openai.com/v1
export COPILOT_PROVIDER_API_KEY=YOUR_OPENAI_KEY
export COPILOT_MODEL=gpt-4o
copilot
```

**Azure OpenAI**

```bash
export COPILOT_PROVIDER_TYPE=azure
export COPILOT_PROVIDER_BASE_URL=https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT-NAME
export COPILOT_PROVIDER_API_KEY=YOUR_AZURE_KEY
export COPILOT_MODEL=YOUR-DEPLOYMENT-NAME
copilot
```

**Anthropic**

```bash
export COPILOT_PROVIDER_TYPE=anthropic
export COPILOT_PROVIDER_BASE_URL=https://api.anthropic.com
export COPILOT_PROVIDER_API_KEY=YOUR_ANTHROPIC_KEY
export COPILOT_MODEL=claude-opus-4-5
copilot
```

如果你想让 CLI 完全只跟本地/私有模型交互，可以再加：

```bash
export COPILOT_OFFLINE=true
```

这会让 CLI 避免联系 GitHub 服务器，但前提是你的模型提供方本身也在本地或同一隔离环境里。

#### 4.11.4 SDK 如何接入其他模型

SDK 的 BYOK 是在 `createSession()` 时传入 `provider` 配置。

**TypeScript / Node.js**

```ts
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({
  model: "gpt-4o",
  provider: {
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

**Azure AI Foundry / OpenAI 兼容端点**

```ts
const session = await client.createSession({
  model: "gpt-5.2-codex",
  provider: {
    type: "openai",
    baseUrl: "https://your-resource.openai.azure.com/openai/v1/",
    wireApi: "responses",
    apiKey: process.env.FOUNDRY_API_KEY,
  },
});
```

**Ollama 本地模型**

```ts
const session = await client.createSession({
  model: "llama3.2",
  provider: {
    type: "openai",
    baseUrl: "http://localhost:11434/v1",
  },
});
```

#### 4.11.5 关键区别：CLI BYOK vs SDK BYOK

| 项目 | CLI BYOK | SDK BYOK |
| --- | --- | --- |
| 配置位置 | 环境变量 | `createSession()` 的 `provider` |
| 启动方式 | `copilot` | 你的应用代码 |
| 适合场景 | 直接让终端 Copilot 用外部模型 | 在应用里集成外部模型驱动的 Copilot |
| 控制粒度 | 中等 | 更细，能配 hooks、模型列表、会话控制 |

#### 4.11.6 什么时候该用 BYOK

- 你想接本地模型
- 你想统一走 Azure / OpenAI / Anthropic 的企业账单
- 你想让 Copilot 在隔离环境里运行
- 你想把模型选择权交给自己的平台

#### 4.11.7 使用 BYOK 时要注意

- 静态 API key 最简单，但要自己管密钥轮换
- 某些更复杂的身份方案不适合 BYOK
- 你的 provider 必须能稳定支持 tool calling 和 streaming
- 不同 provider 的 `baseUrl` 规则不一样，尤其是 Azure

#### 4.11.8 能不能同时使用自己的 API 和官方模型？

**可以同时使用，但不是在同一个 Copilot CLI 会话里“混着用”。**

更准确地说：

- **一个 CLI 会话 / 一个启动进程** 通常只使用**一套 provider 配置**
- 你可以开**另一个终端窗口**，用不同的环境变量启动另一个 `copilot`
- 你也可以在 **SDK 里创建不同的 session**，每个 session 绑定不同的 provider

#### 4.11.9 推荐的使用方式

如果你想两边都保留，最稳的是：

1. 一个终端跑官方 Copilot 模型
2. 另一个终端跑你的 BYOK 模型
3. 或者在自己的应用里用 SDK 做路由：简单问题走官方模型，敏感/本地/私有数据走自有模型

如果你要的是“同一个会话里自动根据任务切换模型”，那就不要直接依赖 CLI 本身，而应该在你自己的应用层做模型路由，再分别调用不同的 Copilot session。

### 4.12 更像真实产品的 SDK 架构

建议按这个顺序搭：

1. 先做一个单会话 demo
2. 再加 streaming
3. 再加 hooks
4. 再加 MCP
5. 再做 session persistence
6. 最后考虑多 agent 编排和 observability

这样最容易控风险。

---

## 5. 什么时候用 CLI，什么时候用 SDK

### 用 CLI 的时候

- 你自己要快速处理开发任务
- 你在本地仓库里改代码
- 你要让 Copilot 帮你跑命令、看 diff、提 PR
- 你想先验证工作流再产品化

### 用 SDK 的时候

- 你要把 Copilot 嵌入产品
- 你要做自己的 AI 助手
- 你要统一管理会话、hooks、权限和工具
- 你要给别的用户提供 Copilot 能力

### 推荐路径

如果你是从 0 到 1：

1. 先用 CLI 学会 Copilot 的工作方式
2. 再用 SDK 把同样的能力接进应用
3. 最后用 MCP / skills / hooks 做深度定制

---

## 6. 实战建议：真正能落地的套路

### 6.1 先把项目上下文喂给 Copilot

CLI 场景下，优先做：

- 在仓库根目录启动
- 写清楚任务边界
- 用 custom instructions 固化团队规则

SDK 场景下，优先做：

- 通过 hooks 注入上下文
- 用 session state 保存必要信息
- 把工具权限收紧到最小集合

### 6.2 对高风险操作做分层授权

建议分层：

1. 只读工具默认开放
2. 写文件工具单独授权
3. Git push / 删除 / 生产发布类命令单独拦截

### 6.3 让它“先规划、再执行”

特别是这些任务：

- 大重构
- 迁移
- 架构改造
- 不熟悉的仓库

先让 Copilot 讲方案，再让它动手，出错率会低很多。

### 6.4 记录和审计

SDK 尤其要做：

- 事件日志
- 工具调用日志
- 错误链路
- 会话 trace

这样后面才知道“它为什么这么做”。

---

## 7. 快速上手清单

### CLI 清单

- 安装 Copilot CLI
- 登录 GitHub
- 在可信仓库里启动
- 试一次计划模式
- 试一次文件修改
- 配一个 custom instruction
- 试一个 MCP server

### SDK 清单

- 选语言：TS / Python / Go / .NET / Java
- 先跑最小示例
- 选择认证方式
- 决定是否 streaming
- 加 hooks
- 接 MCP
- 处理 session persistence
- 记录 observability

---

## 8. 结论

如果你只是想提升个人开发效率，**Copilot CLI** 已经非常够用；如果你想把 Copilot 能力变成自己产品的一部分，**Copilot SDK** 才是正确入口。

最实用的路线通常是：

**先用 CLI 熟悉 Copilot 的行为 → 再用 SDK 把这些能力嵌入你的应用。**

---

## 参考资料

- [GitHub Copilot CLI 概览](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)
- [GitHub Copilot CLI 使用文档](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)
- [GitHub Copilot CLI 自定义文档](https://docs.github.com/en/copilot/how-tos/copilot-cli/add-custom-instructions)
- [GitHub Copilot CLI 技能文档](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
- [GitHub Copilot CLI MCP 扩展](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/extend-cloud-agent-with-mcp)
- [GitHub Copilot SDK 官方主页](https://docs.github.com/en/copilot/how-tos/copilot-sdk)
- [GitHub Copilot SDK Getting Started](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started)
- [GitHub Copilot SDK Authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk)
- [GitHub Copilot SDK BYOK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/bring-your-own-key)
- [GitHub Copilot SDK Setup](https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk)
- [GitHub Copilot SDK Use Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/use-copilot-sdk)
- [GitHub Copilot SDK Hooks](https://docs.github.com/en/copilot/how-tos/copilot-sdk/use-hooks)
- [GitHub Copilot SDK Integrations](https://docs.github.com/en/copilot/how-tos/copilot-sdk/integrations)
- [GitHub Copilot CLI BYOK](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models)
- [`github/copilot-sdk` 仓库 README](https://github.com/github/copilot-sdk)
- [`github/copilot-sdk` Getting Started](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
