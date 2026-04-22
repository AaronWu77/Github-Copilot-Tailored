# DeepSeek API 完整参考报告

> 本报告基于 DeepSeek 官方 API 文档整理，涵盖所有指南与 API 接口。
> 文档来源：https://api-docs.deepseek.com/zh-cn/

---

## 目录

1. [API 概览与认证](#1-api-概览与认证)
2. [列出模型](#2-列出模型)
3. [对话补全 (Chat Completion)](#3-对话补全-chat-completion)
4. [补全 (Completion / FIM)](#4-补全-completion--fim)
5. [思考模式 (Thinking Mode)](#5-思考模式-thinking-mode)
6. [多轮对话 (Multi-round Chat)](#6-多轮对话-multi-round-chat)
7. [对话前缀续写 (Chat Prefix Completion)](#7-对话前缀续写-chat-prefix-completion)
8. [FIM 补全 (Fill In the Middle)](#8-fim-补全-fill-in-the-middle)
9. [JSON 模式 (JSON Mode)](#9-json-模式-json-mode)
10. [工具调用 (Tool Calls)](#10-工具调用-tool-calls)
11. [KV Cache 上下文缓存](#11-kv-cache-上下文缓存)
12. [参数速查表](#12-参数速查表)
13. [常见问题与注意事项](#13-常见问题与注意事项)

---

## 1. API 概览与认证

### 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://api.deepseek.com` |
| Beta URL | `https://api.deepseek.com/beta` |
| 认证方式 | Bearer Token (HTTP Authorization Scheme) |
| API Key | 通过 `Authorization: Bearer <API_KEY>` 或 OpenAI SDK 的 `api_key` 参数传递 |

### OpenAI SDK 初始化

```python
from openai import OpenAI

client = OpenAI(
    api_key="<DeepSeek API Key>",
    base_url="https://api.deepseek.com",
)
```

---

## 2. 列出模型

### 请求

```
GET /models
```

### 响应结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `object` | string | 固定值 `list` |
| `data` | Model[] | 模型列表 |

每个 Model 对象包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 模型标识符 |
| `object` | string | 固定值 `model` |
| `owned_by` | string | 拥有该模型的组织 |

### 主要模型

| 模型 ID | 说明 |
|---------|------|
| `deepseek-chat` | 通用对话模型，支持思考模式和非思考模式 |
| `deepseek-reasoner` | 专用推理模型，默认启用思考模式 |

---

## 3. 对话补全 (Chat Completion)

### 请求

```
POST /chat/completions
```

### 请求参数

#### 必需参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `messages` | object[] | 对话消息列表，至少 1 条消息 |
| `model` | string | 模型 ID，可选：`deepseek-chat`、`deepseek-reasoner` |

#### messages 结构

每条消息包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | string | 角色：`system`、`user`、`assistant`、`tool` |
| `content` | string | 消息内容 |
| `name` | string (可选) | 参与者名称，用于区分同角色多个参与者 |

**Tool 消息额外字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `tool_call_id` | string | 对应的工具调用 ID |

#### 可选参数

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `thinking` | object | null | - | 控制思考模式 |
| `thinking.type` | string | - | `enabled` / `disabled` | `enabled` 启用思考模式，`disabled` 禁用 |
| `temperature` | number | 1 | ≤ 2 | 采样温度，越高越随机 |
| `top_p` | number | 1 | ≤ 1 | 核采样参数，与 temperature 二选一 |
| `max_tokens` | integer | - | - | 最大生成 token 数 |
| `frequency_penalty` | number | 0 | -2 ~ 2 | 频率惩罚，降低重复内容 |
| `presence_penalty` | number | 0 | -2 ~ 2 | 存在惩罚，增加新话题可能性 |
| `stop` | string \| string[] | - | 最多 16 个 | 停止序列 |
| `stream` | boolean | false | - | 是否流式输出 |
| `stream_options` | object | - | - | 流式输出选项 |
| `stream_options.include_usage` | boolean | - | - | 流式末尾是否包含 usage 统计 |
| `response_format` | object | - | - | 输出格式，`{"type": "json_object"}` 启用 JSON 模式 |
| `tools` | object[] | - | 最多 128 个 | 工具列表，仅支持 function 类型 |
| `tool_choice` | string \| object | `none` / `auto` | `none` / `auto` / `required` / 指定函数 | 控制工具调用行为 |
| `logprobs` | boolean | false | - | 是否返回输出 token 的对数概率 |
| `top_logprobs` | integer | - | ≤ 20 | 每个位置返回 top N token 的对数概率 |

#### tools 结构

```json
{
  "type": "function",
  "function": {
    "name": "function_name",
    "description": "功能描述",
    "parameters": {
      "type": "object",
      "properties": { ... },
      "required": [ ... ],
      "strict": false
    }
  }
}
```

#### tool_choice 选项

| 值 | 说明 |
|----|------|
| `none` | 不调用工具，仅生成消息 |
| `auto` | 模型自行选择是否调用工具（有 tools 时的默认值） |
| `required` | 模型必须调用一个或多个工具 |
| `{"type": "function", "function": {"name": "my_function"}}` | 强制调用指定工具 |

### 响应结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符 |
| `choices` | object[] | 生成结果列表 |
| `created` | integer | Unix 时间戳 |
| `model` | string | 使用的模型名 |
| `system_fingerprint` | string | 后端配置指纹 |
| `object` | string | 固定值 `chat.completion` |
| `usage` | object | Token 用量信息 |

#### choices[].message 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | string | 固定值 `assistant` |
| `content` | string \| null | 回答内容 |
| `reasoning_content` | string \| null | 推理内容（仅 `deepseek-reasoner`） |
| `tool_calls` | object[] | 工具调用列表 |

#### choices[].finish_reason

| 值 | 说明 |
|----|------|
| `stop` | 自然停止或遇到 stop 序列 |
| `length` | 达到长度限制 |
| `content_filter` | 触发过滤策略 |
| `tool_calls` | 工具调用 |
| `insufficient_system_resource` | 系统资源不足 |

#### usage 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `prompt_tokens` | integer | 输入 token 数 |
| `completion_tokens` | integer | 输出 token 数 |
| `total_tokens` | integer | 总 token 数 |
| `prompt_cache_hit_tokens` | integer | 命中缓存的 token 数 |
| `prompt_cache_miss_tokens` | integer | 未命中缓存的 token 数 |
| `completion_tokens_details.reasoning_tokens` | integer | 思维链 token 数 |

### 请求示例

```python
from openai import OpenAI

client = OpenAI(api_key="<API_KEY>", base_url="https://api.deepseek.com")

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    temperature=0.7,
    max_tokens=1024,
)

print(response.choices[0].message.content)
```

---

## 4. 补全 (Completion / FIM)

### 请求

```
POST /completions
```

> ⚠️ 需要设置 `base_url="https://api.deepseek.com/beta"`

### 请求参数

| 参数 | 类型 | 必需 | 默认值 | 范围 | 说明 |
|------|------|------|--------|------|------|
| `model` | string | ✓ | - | - | 模型 ID，仅支持 `deepseek-chat` |
| `prompt` | string | ✓ | `Once upon a time,` | - | 提示文本 |
| `suffix` | string | - | - | - | 后缀文本（FIM 场景） |
| `max_tokens` | integer | - | - | - | 最大生成 token 数 |
| `temperature` | number | - | 1 | ≤ 2 | 采样温度 |
| `top_p` | number | - | 1 | ≤ 1 | 核采样参数 |
| `frequency_penalty` | number | - | 0 | -2 ~ 2 | 频率惩罚 |
| `presence_penalty` | number | - | 0 | -2 ~ 2 | 存在惩罚 |
| `stop` | string \| string[] | - | - | 最多 16 个 | 停止序列 |
| `echo` | boolean | - | - | - | 是否在输出中包含 prompt |
| `logprobs` | integer | - | - | ≤ 20 | 返回 top N token 的对数概率 |
| `stream` | boolean | - | false | - | 是否流式输出 |
| `stream_options` | object | - | - | - | 流式选项 |
| `stream_options.include_usage` | boolean | - | - | - | 流式末尾包含 usage |

### 响应结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 补全响应 ID |
| `choices` | object[] | 补全结果列表 |
| `created` | integer | Unix 时间戳 |
| `model` | string | 使用的模型 |
| `system_fingerprint` | string | 后端配置指纹 |
| `object` | string | 固定值 `text_completion` |
| `usage` | object | Token 用量 |

#### choices[].logprobs 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `text_offset` | integer[] | token 在文本中的偏移位置 |
| `token_logprobs` | number[] | token 的对数概率 |
| `tokens` | string[] | token 列表 |
| `top_logprobs` | object[] | 每个位置 top N 的 token 及其概率 |

### 请求示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="<API_KEY>",
    base_url="https://api.deepseek.com/beta",  # 注意 Beta URL
)

response = client.completions.create(
    model="deepseek-chat",
    prompt="def fibonacci(n):",
    suffix="    return fib(n-1) + fib(n-2)",
    max_tokens=128
)

print(response.choices[0].text)
```

---

## 5. 思考模式 (Thinking Mode)

### 概述

DeepSeek 模型支持思考模式：在输出最终回答之前，模型会先输出一段思维链（Chain of Thought）内容，以提升答案准确性。

### 启用方式

**方式一：使用专用推理模型**

```python
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=messages
)
```

**方式二：通过 thinking 参数启用**

```python
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages,
    extra_body={"thinking": {"type": "enabled"}}
)
```

> ⚠️ 使用 OpenAI SDK 时，`thinking` 参数需通过 `extra_body` 传入。

### 输入参数

| 参数 | 默认值 | 最大值 | 说明 |
|------|--------|--------|------|
| `max_tokens` | 32K | 64K | 单次回答最大长度（含思维链输出） |

### 输出字段

| 字段 | 说明 |
|------|------|
| `reasoning_content` | 思维链内容，与 `content` 同级 |
| `content` | 最终回答 |
| `tool_calls` | 工具调用（思考模式下可用） |

### 支持的功能

| 功能 | 支持情况 |
|------|----------|
| JSON Output | ✅ |
| Tool Calls | ✅ |
| 对话补全 | ✅ |
| 对话前缀续写 (Beta) | ✅ |
| FIM 补全 (Beta) | ❌ |

### 不支持的参数

以下参数在思考模式下**不生效**（设置不会报错，但无效）：

- `temperature`
- `top_p`
- `presence_penalty`
- `frequency_penalty`
- `logprobs` / `top_logprobs`（设置会报错）

### 多轮对话中的思考模式

在多轮对话中，模型每轮输出包含 `reasoning_content` 和 `content`。在下一轮对话中，**之前轮的 `reasoning_content` 不会被拼接到上下文**，只有 `content` 会被保留。

```python
# Turn 1
messages = [{"role": "user", "content": "9.11 and 9.8, which is greater?"}]
response = client.chat.completions.create(model="deepseek-reasoner", messages=messages)

reasoning_content = response.choices[0].message.reasoning_content
content = response.choices[0].message.content

# Turn 2 - 仅传入上一轮的 content
messages.append({'role': 'assistant', 'content': content})
messages.append({'role': 'user', 'content': "How many Rs in 'strawberry'?"})
response = client.chat.completions.create(model="deepseek-reasoner", messages=messages)
```

### 思考模式下的工具调用

从 DeepSeek-V3.2 开始，思考模式支持工具调用。模型可在回答前进行多轮"思考 → 调用工具 → 继续思考"的循环。

**关键要点：**

1. 在同一个问题的多个子请求中，需**回传 `reasoning_content`** 让模型继续思考
2. 在新问题开始时，应**丢弃之前的 `reasoning_content`** 以节省网络带宽
3. 如果未正确回传 `reasoning_content`，API 会返回 400 错误

**完整示例：**

```python
import os
import json
from openai import OpenAI

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_date",
            "description": "Get the current date",
            "parameters": {"type": "object", "properties": {}},
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The city name"},
                    "date": {"type": "string", "description": "YYYY-mm-dd format"},
                },
                "required": ["location", "date"]
            },
        }
    },
]

def clear_reasoning_content(messages):
    for message in messages:
        if hasattr(message, 'reasoning_content'):
            message.reasoning_content = None

def run_turn(turn, messages):
    sub_turn = 1
    while True:
        response = client.chat.completions.create(
            model='deepseek-chat',
            messages=messages,
            tools=tools,
            extra_body={"thinking": {"type": "enabled"}}
        )
        messages.append(response.choices[0].message)

        reasoning = response.choices[0].message.reasoning_content
        content = response.choices[0].message.content
        tool_calls = response.choices[0].message.tool_calls

        print(f"Turn {turn}.{sub_turn}")
        print(f"  Reasoning: {reasoning}")
        print(f"  Content: {content}")
        print(f"  Tool Calls: {tool_calls}")

        if tool_calls is None:
            break  # 模型已给出最终答案

        for tool in tool_calls:
            # 执行工具调用（由用户实现）
            tool_result = execute_tool(tool.function.name, json.loads(tool.function.arguments))
            messages.append({
                "role": "tool",
                "tool_call_id": tool.id,
                "content": str(tool_result),
            })
        sub_turn += 1

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url=os.environ.get('DEEPSEEK_BASE_URL'),
)

# 第一个问题
messages = [{"role": "user", "content": "How's the weather in Hangzhou Tomorrow?"}]
run_turn(1, messages)

# 第二个问题 - 建议清除之前的 reasoning_content
clear_reasoning_content(messages)
messages.append({"role": "user", "content": "What should I wear tomorrow?"})
run_turn(2, messages)
```

**直接追加 `response.choices[0].message` 等价于：**

```python
messages.append({
    'role': 'assistant',
    'content': response.choices[0].message.content,
    'reasoning_content': response.choices[0].message.reasoning_content,
    'tool_calls': response.choices[0].message.tool_calls,
})
```

---

## 6. 多轮对话 (Multi-round Chat)

### 核心概念

DeepSeek `/chat/completions` API 是**无状态**的，即服务端不记录用户请求的上下文。用户在每次请求时，**需将之前所有对话历史拼接好后**传递给 API。

### 工作流程

1. 第一轮：发送用户消息 → 获取模型回复 → 将用户消息和模型回复都存入 messages
2. 第二轮：在已有 messages 基础上追加新的用户消息 → 再次请求 → 存入新回复
3. 以此类推

### 代码示例

```python
from openai import OpenAI

client = OpenAI(api_key="<API_KEY>", base_url="https://api.deepseek.com")

# Round 1
messages = [{"role": "user", "content": "What's the highest mountain in the world?"}]
response = client.chat.completions.create(model="deepseek-chat", messages=messages)
messages.append(response.choices[0].message)
print(f"Messages Round 1: {messages}")

# Round 2
messages.append({"role": "user", "content": "What is the second?"})
response = client.chat.completions.create(model="deepseek-chat", messages=messages)
messages.append(response.choices[0].message)
print(f"Messages Round 2: {messages}")
```

---

## 7. 对话前缀续写 (Chat Prefix Completion)

### 概述

对话前缀续写允许用户以 `assistant` 角色的消息作为前缀，强制模型从该前缀开始续写内容。常用于强制模型以特定格式或语言输出。

> ⚠️ 此功能为 **Beta** 功能，需要设置 `base_url="https://api.deepseek.com/beta"`

### 使用方法

在 messages 中设置一条 `assistant` 消息，并添加 `"prefix": True` 字段。

### 代码示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="<API_KEY>",
    base_url="https://api.deepseek.com/beta",  # 注意 Beta URL
)

messages = [
    {"role": "user", "content": "Please write quick sort code"},
    {"role": "assistant", "content": "```python\n", "prefix": True}
]

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages,
    stop=["```"],  # 在遇到 ``` 时停止
)

print(response.choices[0].message.content)
```

---

## 8. FIM 补全 (Fill In the Middle)

### 概述

FIM（Fill In the Middle）补全允许用户提供前缀和后缀（可选），模型来补全中间的内容。常用于代码续写、代码补全等场景。

> ⚠️ 此功能为 **Beta** 功能，需要设置 `base_url="https://api.deepseek.com/beta"`

### 注意事项

1. 模型最大补全长度为 **4K**
2. 需设置 `base_url="https://api.deepseek.com/beta"`

### 代码示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="<API_KEY>",
    base_url="https://api.deepseek.com/beta",
)

response = client.completions.create(
    model="deepseek-chat",
    prompt="def fib(a):",
    suffix="    return fib(a-1) + fib(a-2)",
    max_tokens=128
)

print(response.choices[0].text)
```

### 配置 Continue 代码补全插件

[Continue](https://continue.dev) 是一款支持代码补全的 VSCode 插件，可参考以下文档配置以使用 DeepSeek 的代码补全功能：

https://github.com/deepseek-ai/awesome-deepseek-integration/blob/main/docs/continue/README_cn.md

---

## 9. JSON 模式 (JSON Mode)

### 概述

JSON 模式确保模型输出的内容是有效的 JSON 格式。

### 使用方法

设置 `response_format={"type": "json_object"}`，同时在系统或用户消息中指示模型生成 JSON。

### ⚠️ 重要注意事项

- 使用 JSON 模式时，**必须**通过系统或用户消息指示模型生成 JSON
- 否则模型可能会生成空白字符直到达到 token 限制，导致请求"卡住"
- 如果 `finish_reason="length"`，内容可能被截断

### 代码示例

```python
import json
from openai import OpenAI

client = OpenAI(api_key="<API_KEY>", base_url="https://api.deepseek.com")

system_prompt = """The user will provide some exam text. Please parse the "question" and "answer" and output them in JSON format.

EXAMPLE INPUT:
Which is the highest mountain in the world? Mount Everest.

EXAMPLE JSON OUTPUT:
{
    "question": "Which is the highest mountain in the world?",
    "answer": "Mount Everest"
}"""

user_prompt = "Which is the longest river in the world? The Nile River."

messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": user_prompt}
]

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages,
    response_format={"type": "json_object"}
)

print(json.loads(response.choices[0].message.content))
# 输出: {"question": "Which is the longest river in the world?", "answer": "The Nile River."}
```

---

## 10. 工具调用 (Tool Calls)

### 概述

Tool Calls 让模型能够调用外部工具来增强自身能力。模型不执行具体函数，仅提供调用指令，函数执行需由用户提供。

### 非思考模式示例

以获取天气信息为例：

```python
from openai import OpenAI

client = OpenAI(api_key="<API_KEY>", base_url="https://api.deepseek.com")

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply a location first.",
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

def send_messages(messages):
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        tools=tools
    )
    return response.choices[0].message

# 第一轮：用户提问
messages = [{"role": "user", "content": "How's the weather in Hangzhou, Zhejiang?"}]
message = send_messages(messages)
print(f"User>\t {messages[0]['content']}")

# 模型返回工具调用
tool = message.tool_calls[0]
messages.append(message)

# 用户执行工具调用，并将结果传给模型
messages.append({"role": "tool", "tool_call_id": tool.id, "content": "24℃"})
message = send_messages(messages)
print(f"Model>\t {message.content}")
```

**执行流程：**

1. 用户询问天气
2. 模型返回 function 调用 `get_weather({location: 'Hangzhou'})`
3. 用户调用函数并将结果传给模型
4. 模型返回自然语言回答："The current temperature in Hangzhou is 24°C."

### 思考模式下的工具调用

从 DeepSeek-V3.2 开始，思考模式支持工具调用。详见 [思考模式](#5-思考模式-thinking-mode) 章节。

### Strict 模式（Beta）

在 `strict` 模式下，模型在输出 Function 调用时会严格遵循 Function 的 JSON Schema 格式要求。

#### 启用条件

1. 设置 `base_url="https://api.deepseek.com/beta"`
2. `tools` 列表中所有 function 的 `strict` 属性设为 `true`
3. 服务端会校验 JSON Schema，不符合规范将返回错误

#### Strict 模式支持的 JSON Schema 类型

| 类型 | 说明 |
|------|------|
| `object` | 键值对深层结构 |
| `string` | 字符串 |
| `number` / `integer` | 数字 |
| `boolean` | 布尔值 |
| `array` | 数组 |
| `enum` | 枚举 |
| `anyOf` | 多类型匹配 |

#### Object 类型

```json
{
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "age": {"type": "integer"}
  },
  "required": ["name", "age"],
  "additionalProperties": false
}
```

> ⚠️ **必须**设置 `required` 包含所有属性，且 `additionalProperties` 为 `false`

#### String 类型

**支持参数：**
- `pattern`：正则表达式
- `format`：`email`、`hostname`、`ipv4`、`ipv6`、`uuid`

**不支持参数：**
- `minLength`、`maxLength`

```json
{
  "type": "object",
  "properties": {
    "user_email": {
      "type": "string",
      "format": "email",
      "description": "The user's email address"
    },
    "zip_code": {
      "type": "string",
      "pattern": "^\\d{6}$",
      "description": "Six digit postal code"
    }
  }
}
```

#### Number / Integer 类型

**支持参数：** `const`、`default`、`minimum`、`maximum`、`exclusiveMinimum`、`exclusiveMaximum`、`multipleOf`

```json
{
  "type": "object",
  "properties": {
    "score": {
      "type": "integer",
      "description": "A number from 1-5",
      "minimum": 1,
      "maximum": 5
    }
  },
  "required": ["score"],
  "additionalProperties": false
}
```

#### Array 类型

**不支持参数：** `minItems`、`maxItems`

```json
{
  "type": "object",
  "properties": {
    "keywords": {
      "type": "array",
      "description": "Five keywords sorted by importance",
      "items": {
        "type": "string",
        "description": "A concise keyword"
      }
    }
  },
  "required": ["keywords"],
  "additionalProperties": false
}
```

#### Enum

```json
{
  "type": "object",
  "properties": {
    "order_status": {
      "type": "string",
      "enum": ["pending", "processing", "shipped", "cancelled"]
    }
  }
}
```

#### AnyOf

```json
{
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {"type": "string", "format": "email", "description": "Email address"},
        {"type": "string", "pattern": "^\\d{11}$", "description": "11-digit phone number"}
      ]
    }
  }
}
```

#### $ref 和 $def

使用 `$def` 定义模块，`$ref` 引用来减少重复：

```json
{
  "type": "object",
  "properties": {
    "report_date": {"type": "string", "description": "Publication date"},
    "authors": {
      "type": "array",
      "items": {"$ref": "#/$def/author"}
    }
  },
  "required": ["report_date", "authors"],
  "additionalProperties": false,
  "$def": {
    "author": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "institution": {"type": "string"},
        "email": {"type": "string", "format": "email"}
      },
      "additionalProperties": false,
      "required": ["name", "institution", "email"]
    }
  }
}
```

#### Strict 模式 Tool 定义示例

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "strict": true,
    "description": "Get weather of a location",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "The city and state, e.g. San Francisco, CA"
        }
      },
      "required": ["location"],
      "additionalProperties": false
    }
  }
}
```

---

## 11. KV Cache 上下文缓存

### 概述

DeepSeek API 的上下文硬盘缓存技术对所有用户**默认开启**，用户无需修改代码即可享用。

### 工作原理

- 每个请求都会触发硬盘缓存的构建
- 后续请求与之前请求的**前缀**存在重复时，重复部分从缓存拉取，计入"缓存命中"
- 只有**重复的前缀部分**才能触发缓存命中

### 示例一：长文本问答

```
# 第一次请求
messages: [
  {"role": "system", "content": "你是一位资深的财报分析师..."},
  {"role": "user", "content": "<财报内容>\n\n请总结关键信息。"}
]

# 第二次请求
messages: [
  {"role": "system", "content": "你是一位资深的财报分析师..."},  # 相同前缀
  {"role": "user", "content": "<财报内容>\n\n请分析盈利情况。"}    # 不同后缀
]
```

第二次请求中，`system` 消息 + `user` 消息中的 `<财报内容>` 部分会计入缓存命中。

### 示例二：多轮对话

```
# 第一次请求
messages: [
  {"role": "system", "content": "你是一位乐于助人的助手"},
  {"role": "user", "content": "中国的首都是哪里？"}
]

# 第二次请求
messages: [
  {"role": "system", "content": "你是一位乐于助人的助手"},  # 相同前缀
  {"role": "user", "content": "中国的首都是哪里？"},
  {"role": "assistant", "content": "中国的首都是北京。"},
  {"role": "user", "content": "美国的首都是哪里？"}
]
```

第二次请求可复用第一次请求开头的 `system` 和第一条 `user` 消息。

### 示例三：Few-shot 学习

在 Few-shot 学习中，由于一般提供相同上下文前缀，在缓存加持下费用显著降低。

### 查看缓存命中

API 返回的 `usage` 字段包含两个字段：

| 字段 | 说明 | 价格 |
|------|------|------|
| `prompt_cache_hit_tokens` | 缓存命中的 token 数 | 0.1 元/百万 tokens |
| `prompt_cache_miss_tokens` | 缓存未命中的 token 数 | 1 元/百万 tokens |

### 缓存与输出随机性

- 缓存只匹配输入前缀
- 输出仍通过计算推理得到
- 受 `temperature` 等参数影响，仍有随机性
- 输出效果与不使用缓存相同

### 其它说明

| 项目 | 说明 |
|------|------|
| 存储单元 | 64 tokens 为一个单元，不足 64 tokens 不会被缓存 |
| 命中保证 | "尽力而为"，不保证 100% 命中 |
| 缓存构建 | 秒级耗时 |
| 缓存清理 | 不再使用后自动清空，一般几小时到几天 |

---

## 12. 参数速查表

### Chat Completion vs Completion 参数对比

| 参数 | Chat Completion | Completion | 备注 |
|------|-----------------|------------|------|
| `model` | `deepseek-chat`, `deepseek-reasoner` | `deepseek-chat` | - |
| `messages` | ✅ | ❌ | Chat 专用 |
| `prompt` | ❌ | ✅ | Completion 专用 |
| `suffix` | ❌ | ✅ | FIM 场景 |
| `thinking` | ✅ | ❌ | 思考模式 |
| `temperature` | ✅ (≤2) | ✅ (≤2) | - |
| `top_p` | ✅ (≤1) | ✅ (≤1) | - |
| `max_tokens` | ✅ | ✅ | - |
| `frequency_penalty` | ✅ (-2~2) | ✅ (-2~2) | - |
| `presence_penalty` | ✅ (-2~2) | ✅ (-2~2) | - |
| `stop` | ✅ (≤16个) | ✅ (≤16个) | - |
| `stream` | ✅ | ✅ | - |
| `response_format` | ✅ | ❌ | JSON 模式 |
| `tools` | ✅ (≤128个) | ❌ | - |
| `tool_choice` | ✅ | ❌ | - |
| `logprobs` | ✅ (boolean) | ✅ (integer ≤20) | 类型不同 |
| `top_logprobs` | ✅ (≤20) | ❌ | 需 logprobs=true |
| `echo` | ❌ | ✅ | - |

### 思考模式参数兼容性

| 参数 | 思考模式下是否生效 |
|------|-------------------|
| `max_tokens` | ✅ (默认 32K, 最大 64K) |
| `temperature` | ❌ (不报错但不生效) |
| `top_p` | ❌ (不报错但不生效) |
| `presence_penalty` | ❌ (不报错但不生效) |
| `frequency_penalty` | ❌ (不报错但不生效) |
| `logprobs` | ❌ (会报错) |
| `top_logprobs` | ❌ (会报错) |

### Beta 功能清单

| 功能 | Base URL | 说明 |
|------|----------|------|
| FIM 补全 | `/beta` | Fill In the Middle |
| 对话前缀续写 | `/beta` | Assistant Prefix |
| Strict 模式 | `/beta` | 严格 JSON Schema 工具调用 |

### 价格参考（缓存）

| 类型 | 价格 |
|------|------|
| 缓存命中 | 0.1 元/百万 tokens |
| 缓存未命中 | 1 元/百万 tokens |

---

## 13. 常见问题与注意事项

### Q1: 如何启用思考模式？

两种方式：
1. 使用 `model="deepseek-reasoner"`
2. 使用 `model="deepseek-chat"` 并传入 `extra_body={"thinking": {"type": "enabled"}}`

### Q2: 思考模式下哪些参数不生效？

`temperature`、`top_p`、`presence_penalty`、`frequency_penalty` 不生效（不报错）。`logprobs` 和 `top_logprobs` 会直接报错。

### Q3: 多轮对话需要手动维护上下文吗？

是的，API 是无状态的，每次请求需要手动将历史消息拼接传入。

### Q4: JSON 模式为什么"卡住"了？

必须同时在 system 或 user 消息中指示模型输出 JSON 格式，否则模型可能不断生成空白字符。

### Q5: FIM 补全为什么报错？

1. 确保 `base_url` 设置为 `https://api.deepseek.com/beta`
2. 最大补全长度为 4K tokens

### Q6: 工具调用中 strict 模式有什么要求？

1. `base_url` 必须设为 Beta 地址
2. 所有 function 的 `strict` 属性需为 `true`
3. `object` 类型必须设置 `required` 包含所有属性，且 `additionalProperties` 为 `false`

### Q7: KV Cache 如何省钱？

当请求有共同前缀时（如同一个 system prompt 或相同的长文档），缓存命中部分按 0.1 元/百万 tokens 计费，是未命中价格的 1/10。

### Q8: 思考模式下工具调用为什么报 400 错误？

可能是因为未正确回传 `reasoning_content`。在同一个问题的多轮工具调用中，必须回传 `reasoning_content`；新问题开始时应清除之前的 `reasoning_content`。

### Q9: 思考模式支持哪些功能？

✅ JSON Output、Tool Calls、对话补全、对话前缀续写
❌ FIM 补全

---

*报告生成时间：2026-04-21*
*文档来源：DeepSeek 官方 API 文档 (https://api-docs.deepseek.com/zh-cn/)*
