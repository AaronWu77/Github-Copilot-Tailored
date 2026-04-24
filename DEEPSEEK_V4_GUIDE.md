# DeepSeek V4 API 完整指南

> 基于 DeepSeek 官方 API 文档（https://api-docs.deepseek.com/）整理
> 最后更新：2026-04-24

---

## 目录

1. [API 概览与认证](#1-api-概览与认证)
2. [可用模型](#2-可用模型)
3. [对话补全 (Chat Completion)](#3-对话补全)
4. [思考模式 (Thinking Mode)](#4-思考模式)
5. [多轮对话](#5-多轮对话)
6. [工具调用 (Tool Calls)](#6-工具调用)
7. [JSON 模式](#7-json-模式)
8. [KV Cache 上下文缓存](#8-kv-cache)
9. [对话前缀续写](#9-对话前缀续写)
10. [FIM 补全](#10-fim-补全)
11. [Anthropic API 格式](#11-anthropic-api-格式)
12. [集成编码代理](#12-集成编码代理)
13. [GitHub Copilot CLI BYOK 配置](#13-github-copilot-cli-byok-配置)

---

## 1. API 概览与认证

### 基础信息

| 项目 | 值 |
|------|-----|
| Base URL (OpenAI) | `https://api.deepseek.com` |
| Base URL (Anthropic) | `https://api.deepseek.com/anthropic` |
| Beta URL | `https://api.deepseek.com/beta` |
| 认证方式 | Bearer Token |

### OpenAI SDK 初始化

```python
from openai import OpenAI

client = OpenAI(
    api_key="<DeepSeek API Key>",
    base_url="https://api.deepseek.com",
)
```

---

## 2. 可用模型

### 当前推荐模型

| 模型 ID | 说明 | 思考模式 |
|---------|------|----------|
| `deepseek-v4-flash` | 通用对话模型，轻量高效 | ✅ 默认启用 |
| `deepseek-v4-pro` | 专业级模型，更强推理能力 | ✅ 必须启用 |

### 即将废弃的模型（2026/07/24 后废弃）

| 模型 ID | 对应新模型 | 说明 |
|---------|-----------|------|
| `deepseek-chat` | `deepseek-v4-flash` 非思考模式 | 通用对话 |
| `deepseek-reasoner` | `deepseek-v4-flash` 思考模式 | 推理专用 |

---

## 3. 对话补全

### 请求

```
POST /chat/completions
```

### 必需参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `messages` | object[] | 对话消息列表，至少 1 条 |
| `model` | string | 模型 ID |

### 可选参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `thinking` | object | - | 思考模式控制 `{"type": "enabled/disabled"}` |
| `reasoning_effort` | string | - | 思考努力程度 `high` / `max` |
| `temperature` | number | 1 | 采样温度（思考模式无效） |
| `top_p` | number | 1 | 核采样（思考模式无效） |
| `max_tokens` | integer | - | 最大生成 token 数 |
| `stream` | boolean | false | 是否流式输出 |
| `response_format` | object | - | `{"type": "json_object"}` 启用 JSON 模式 |
| `tools` | object[] | - | 工具列表（最多 128 个） |
| `stop` | string \| string[] | - | 停止序列（最多 16 个） |

### 基本示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    stream=False,
)
print(response.choices[0].message.content)
```

---

## 4. 思考模式

DeepSeek V4 支持思考模式（Chain-of-Thought），模型在输出最终答案前先进行推理。

### 控制参数

| OpenAI 格式 | Anthropic 格式 | 说明 |
|-------------|---------------|------|
| `{"thinking": {"type": "enabled/disabled"}}` | - | 思考开关 |
| `{"reasoning_effort": "high/max"}` | `{"output_config": {"effort": "high/max"}}` | 思考努力程度 |

### 注意事项

- 思考模式**默认启用**（`thinking` toggle 默认 `enabled`）
- 思考模式下**不支持** `temperature`、`top_p`、`presence_penalty`、`frequency_penalty`
- 思维链内容通过 `reasoning_content` 参数返回，与 `content` 同级
- 常规请求默认努力程度为 `high`，复杂 agent 请求（如 Claude Code）自动设为 `max`

### 启用思考模式示例

```python
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": "9.11 and 9.8, which is greater?"}],
    reasoning_effort="high",
    extra_body={"thinking": {"type": "enabled"}},
)

# 获取思考内容和最终答案
reasoning_content = response.choices[0].message.reasoning_content
content = response.choices[0].message.content
print(f"Reasoning: {reasoning_content}")
print(f"Answer: {content}")
```

---

## 5. 多轮对话

DeepSeek `/chat/completions` API 是**无状态**的，必须手动拼接所有历史对话。

### 无工具调用的多轮对话

- 两轮 `user` 消息之间的 `assistant` 的 `reasoning_content` **不需要**参与上下文拼接
- 如果传递了也会被 API 忽略

```python
# Round 1
messages = [{"role": "user", "content": "What's the highest mountain?"}]
response = client.chat.completions.create(model="deepseek-v4-pro", messages=messages)
messages.append(response.choices[0].message)

# Round 2 - reasoning_content 会被忽略
messages.append({"role": "user", "content": "What is the second?"})
response = client.chat.completions.create(model="deepseek-v4-pro", messages=messages)
```

### 有工具调用的多轮对话

- 执行过工具调用的轮次，`reasoning_content` **必须**参与上下文拼接
- 后续所有请求都**必须回传** `reasoning_content`，否则会返回 400 错误

### 切换新问题时的最佳实践

```python
def clear_reasoning_content(messages):
    """切换新问题时清除之前的 reasoning_content"""
    for message in messages:
        if hasattr(message, 'reasoning_content'):
            message.reasoning_content = None

# 新问题开始时清除之前的 reasoning_content
clear_reasoning_content(messages)
```

---

## 6. 工具调用

从 DeepSeek-V3.2 开始，思考模式支持工具调用。

### 基本示例

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    }
                },
                "required": ["location"]
            },
        }
    },
]

messages = [{"role": "user", "content": "How's the weather in Hangzhou?"}]
message = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    tools=tools
).choices[0].message

# 执行工具调用
tool = message.tool_calls[0]
messages.append(message)
messages.append({"role": "tool", "tool_call_id": tool.id, "content": "24℃"})
message = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    tools=tools
).choices[0].message
print(message.content)
```

### Strict 模式（Beta）

启用方式：
1. 使用 `base_url="https://api.deepseek.com/beta"`
2. 在 `tools` 参数中，所有 `function` 设置 `strict: true`
3. 服务器会校验 JSON Schema 是否符合规范

支持的数据类型：`object`, `string`, `number`, `integer`, `boolean`, `array`, `enum`, `anyOf`

---

## 7. JSON 模式

通过 `response_format` 确保模型输出合法的 JSON 字符串。

```python
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[
        {"role": "system", "content": "Parse the question and answer in JSON format."},
        {"role": "user", "content": "Which is the longest river? The Nile."}
    ],
    response_format={"type": "json_object"}
)
print(json.loads(response.choices[0].message.content))
```

---

## 8. KV Cache

DeepSeek API **默认启用**磁盘上下文缓存技术。

### 缓存命中规则

- 只有**前缀重复**部分能触发缓存命中
- 相同 system message + 相同长文本前缀可复用

### 计费

| 类型 | 价格 |
|------|------|
| 缓存命中 token | 0.1 元/百万 token |
| 缓存未命中 token | 按正常价格 |

### 查看缓存命中状态

响应中的 `usage` 字段包含：
- `prompt_cache_hit_tokens`: 缓存命中的 token 数
- `prompt_cache_miss_tokens`: 缓存未命中的 token 数

---

## 9. 对话前缀续写

用户提供 assistant 的前缀消息，让模型完成剩余内容。

```python
client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com/beta",  # 需要 Beta URL
)

messages = [
    {"role": "user", "content": "Please write quick sort code"},
    {"role": "assistant", "content": "```python\n", "prefix": True}  # 前缀标记
]

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    stop=["```"],
)
print(response.choices[0].message.content)
```

---

## 10. FIM 补全

FIM (Fill In the Middle) 用于代码补全。

```python
client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com/beta",
)

response = client.completions.create(
    model="deepseek-v4-pro",
    prompt="def fib(a):",
    suffix="    return fib(a-1) + fib(a-2)",
    max_tokens=128
)
print(response.choices[0].text)
```

---

## 11. Anthropic API 格式

DeepSeek 支持 Anthropic API 格式调用：

```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://api.deepseek.com/anthropic",
    api_key="<DeepSeek API Key>",
)

message = client.messages.create(
    model="deepseek-v4-pro",
    max_tokens=1000,
    system="You are a helpful assistant.",
    messages=[
        {"role": "user", "content": [{"type": "text", "text": "Hi!"}]}
    ]
)
```

**注意**: 不支持的 model 名称会自动映射到 `deepseek-v4-flash`。

### 支持的 Content 类型

| 类型 | 支持状态 |
|------|---------|
| `text` | ✅ 完全支持 |
| `thinking` | ✅ 支持 |
| `tool_use` | ✅ 完全支持 |
| `tool_result` | ✅ 完全支持 |
| `image` | ❌ 不支持 |
| `document` | ❌ 不支持 |
| `redacted_thinking` | ❌ 不支持 |

---

## 12. 集成编码代理

### Claude Code 集成

```bash
npm install -g @anthropic-ai/claude-code

export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_AUTH_TOKEN=${DEEPSEEK_API_KEY}
export ANTHROPIC_MODEL=deepseek-v4-pro
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK=1
export CLAUDE_CODE_EFFORT_LEVEL=max

claude
```

### OpenCode 集成

在 `~/.config/opencode/opencode.jsonc` 中添加：

```json
{
  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/anthropic",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com/anthropic",
        "apiKey": "<DeepSeek API Key>"
      },
      "models": {
        "deepseek-v4-pro": {
          "name": "DeepSeek-V4-Pro",
          "limit": {
            "context": 1048576,
            "output": 262144
          },
          "options": {
            "reasoningEffort": "max",
            "thinking": {
              "type": "enabled"
            }
          }
        }
      }
    }
  }
}
```

---

## 13. GitHub Copilot CLI BYOK 配置

### 问题背景

GitHub Copilot CLI 的 BYOK 配置通过环境变量控制，但**不支持** `extra_body` 参数。DeepSeek 的思考模式需要通过 `extra_body` 传入 `{"thinking": {"type": "enabled"}}`，这是一个限制。

### 支持的环境变量

| 环境变量 | 必需 | 说明 |
|---------|------|------|
| `COPILOT_PROVIDER_BASE_URL` | ✅ | API 基础 URL |
| `COPILOT_PROVIDER_TYPE` | ❌ | 类型：`openai`(默认) / `azure` / `anthropic` |
| `COPILOT_PROVIDER_API_KEY` | ❌ | API Key |
| `COPILOT_MODEL` | ✅ | 模型 ID |
| `COPILOT_PROVIDER_MAX_PROMPT_TOKENS` | ❌ | 最大 prompt token 数 |
| `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS` | ❌ | 最大输出 token 数 |
| `COPILOT_OFFLINE` | ❌ | 离线模式 `true`/`false` |

### DeepSeek v4-pro 思考模式配置方案

#### 方案一：环境变量（已验证）

在 `deepseek.env` 中添加：

```env
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=your_api_key
COPILOT_MODEL=deepseek-v4-pro
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=256000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096
COPILOT_PROVIDER_REQUEST_BODY_PARAMS={"thinking":{"type":"enabled"}}
```

#### 方案二：使用默认启用的模型

`deepseek-v4-flash` 和 `deepseek-v4-pro` 的思考模式**默认启用**，可以直接使用：

```env
COPILOT_MODEL=deepseek-v4-pro
```

### Windows 启动脚本（PowerShell）

```powershell
# ~/.copilot/deepseek.env 已配置完成
# ~/bin/copilot-deepseek.ps1

Get-Content "$HOME\.copilot\deepseek.env" | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}
copilot
```

### macOS/Linux 启动脚本

```bash
#!/bin/zsh  # 或 #!/bin/bash
set -a
source ~/.copilot/deepseek.env
set +a
exec copilot
```

---

## 常见问题

### Q: 思考模式下为什么 temperature 无效？

A: 思考模式不使用采样参数，`temperature`、`top_p` 等参数会被忽略。

### Q: 工具调用时返回 400 错误？

A: 检查是否正确回传了 `reasoning_content`。有工具调用的轮次，后续所有请求必须包含 `reasoning_content`。

### Q: 如何选择 thinking 的 effort？

A: 常规问题使用 `high`（默认），复杂编码代理任务使用 `max`。

### Q: `deepseek-chat` 和 `deepseek-reasoner` 还能用吗？

A: 可以，但将在 2026/07/24 后废弃。建议迁移到 `deepseek-v4-flash` 或 `deepseek-v4-pro`。
