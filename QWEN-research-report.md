QWEN（通义千问）调研报告 — API 使用方法、配置与计费（草案）

摘要
-----
本报告收集并整理了可公开获取的 Qwen（通义千问）系列模型的接入方式（包括 DashScope 的 OpenAI 兼容模式与原生 API）、常用调用示例、上下文与 token 限制、流式/函数调用支持、以及公开来源的计费/定价参考。报告同时结合仓库内现有内容（README 中的 Copilot 启动脚本与 usage-monitor-web 原型），给出接入、监控、与费用估计的实践建议与配置示例。

重要说明
----------
- 用户给出的阿里云控制台链接为控制台/产品页，通常需要登录控制台才能查看完整内容。对外公开的文档与 API 参考以阿里云 Model Studio（DashScope）和帮助中心（help.aliyun.com）为准。
- 下列定价属于公开资料或社区整理的参考值，实际计费请以阿里云控制台计费页与账单为准。

仓库相关上下文
---------------
- 本仓库 README.md 已包含针对 DeepSeek 与 Qwen 的 Copilot 启动脚本与环境变量示例（~/.copilot/qwen.env、copilot-qwen）——推荐使用 OpenAI 兼容的 DashScope base_url: https://dashscope.aliyuncs.com/compatible-mode/v1，并通过环境变量保存 API Key 与模型名。
- 仓库提供的 usage-monitor-web 作为独立原型，可用于轮询 provider 的 usage/balance API 并在本地展示消耗/额度，适合进一步实现成本监控与告警。

一、主要文档与入口（公开）
---------------------------
- 阿里云 Model Studio（DashScope）帮助中心（Qwen API 与 DashScope 兼容模式说明）：
  - https://help.aliyun.com/zh/model-studio/ (Model Studio 帮助中心/API 参考)
  - DashScope OpenAI 兼容说明（OpenAI-compatible API）：见 Model Studio 的兼容文档
- DashScope / 控制台入口（需登录）：https://dashscope.console.aliyun.com/ 或 https://bailian.console.aliyun.com/（用户给出的链接）
- 社区与第三方指南（示例/实践）：若干博客与教程汇总（列于附录）

二、接入方式概览
----------------
1) OpenAI-compatible（兼容模式，推荐）
- Base URL（中国大陆示例）：
  https://dashscope.aliyuncs.com/compatible-mode/v1
- 常用 endpoint（chat-style）：
  POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
- 优点：能最小改动地复用现有 OpenAI SDK/客户端（例如 openai 的官方或兼容 SDK），方便在现有应用中切换。

2) DashScope 原生 API
- 文本生成（示例 endpoint）：
  POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
- 多模态/图像/语音等多模态接口路径在文档中另行列出
- 优点：可能更完整地暴露平台特性与能力设置，SDK/示例与官方文档配套说明更详尽。

三、鉴权与密钥管理
------------------
- 在阿里云 Model Studio / DashScope 控制台生成 API Key（或 Access Key/Secret 视平台而定），采用环境变量保存并在启动脚本中加载。示例 env 变量：
  - COPILOT_PROVIDER_API_KEY / DASHSCOPE_API_KEY（取决于使用的客户端/脚本）
- 推荐做法：
  - 不在仓库中保存密钥；使用 ~/.copilot/qwen.env（已加入 README 建议）并将本地 env 文件加入 .gitignore。
  - 对长期运行服务使用最小权限 Key；Key 泄露时立刻在控制台作废并重建。

四、模型列表（常见、示例）与场景建议
------------------------------------
（模型名称会随产品更新而变化，请以控制台/官方文档为准）
- qwen3.6-plus / Qwen 3.6 Plus：超大上下文（1M tokens）、面向 Agent 与超长文本场景，适合仓库级别代码理解、长文生成、复杂推理。
- qwen3.5-plus / qwen-plus：通用高性价比模型，适合日常对话、摘要、问答。
- qwen3-max：更高能力点，适用于对质量/复杂度苛刻的任务。
- qwen3-coder-next：专用于代码理解与生成。
- 多模态系列（若需要处理图像/语音）：参见 DashScope 多模态产品线。

模型选型建议：
- 日常对话、FAQ、摘要：qwen-plus
- 大上下文/Agent/长文：qwen3.6-plus
- 代码自动化：qwen3-coder-next 或 qwen3 系列

五、上下文窗口、token 与输出限制
---------------------------------
- Qwen3.6-Plus：文档/公告中宣称可支持“1M tokens”的上下文窗口（需以控制台配置/SDK限制为准）。
- Qwen Plus 系列常见上下文：几十万到百万量级；输出上限依照模型与 API 限制（例如 README 样例设置 COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536）。
- 注意：OpenAI 兼容模式下有时需要在客户端手动指定 max_tokens、input length 等以避免被 SDK 或客户端库截断。

六、流式输出（Streaming）与 function/tool-calling
-------------------------------------------------
- DashScope 的 OpenAI 兼容接口通常支持流式（stream）返回和 chunked 输出；如果应用需要低延迟首字节输出，请使用流式接口。
- Function calling（工具调用）支持：在兼容层会以与 OpenAI 类似的 function-calling 交互形式暴露（具体字段名/格式以官方兼容文档为准）。

七、示例：curl / Python（OpenAI-compatible）
-------------------------------------------
1) curl 示例（Chat Completions）：

curl -s -X POST "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_QWEN_KEY" \
  -d '{
    "model": "qwen3.6-plus",
    "messages": [{"role":"user","content":"帮我写一段介绍 Qwen3.6-plus 的文字"}],
    "max_tokens": 1024
  }'

2) Python（openai 兼容）示例：

# 使用兼容的库或 openai 客户端并设置 base_url
from openai import OpenAI
client = OpenAI(api_key="YOUR_QWEN_KEY", base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
resp = client.chat.completions.create(
  model="qwen3.6-plus",
  messages=[{"role":"user","content":"解释 Qwen3.6-plus 的优势"}],
  max_tokens=512
)
print(resp.choices[0].message.content)

（注意：不同 SDK 兼容性细节请参照你所用 SDK 的 "base_url" / "api_key" 参数写法）

八、计费与价格参考（请以官方为准）
--------------------------------
- 计费维度通常按输入 tokens（prompt）与输出 tokens（response）计费，也可能含有并发限制或吞吐阶梯价。
- 下表为社区/公开资料汇总的示例参考（近似值，仅用于初步预算）：

| 模型 / 套餐 | 输入价（$ / 1M tokens） | 输出价（$ / 1M tokens） | 说明 |
|---|---:|---:|---|
| Qwen Plus（通用） | ~0.12 | ~0.29 | 适合大多数文本任务 |
| Qwen3 Max | ~0.36 | ~1.43 | 质量/复杂度更高 |
| Qwen3.6 Plus（企业/大上下文） | 视具体产品线与区域而定 | 视具体产品线与区域而定 | 1M 上下文支持，价格可能溢出常规模型 |

- 计费细节与优惠：有时阿里云会在新模型/预览期提供免费额度或促销，且不同地域与账户层级（个人/企业）计费策略不同，请在控制台查看“计费/价格”页面并关注公告。

九、监控与成本控制建议
----------------------
- 开发阶段：启用较低配额或试验账户，以免调试请求消耗过多费用。
- 生产阶段：
  - 在调用前做输入预处理、摘要化（truncate/抽取关键信息）以减少 prompt tokens。
  - 使用流式返回时统计每次响应的实际 token 用量并上报账单表。
  - 利用 usage-monitor-web 或自建监控定期调用 provider 的 usage/balance API 并在超额或异常时触发告警。
  - 开启请求限流、并发控制与重试策略，避免突发流量导致费用暴涨。

十、在本仓库快速接入（按 README 可复用）
-----------------------------------------
- 将 ~/.copilot/qwen.env 按 README 示例填好（COPILOT_PROVIDER_BASE_URL 指向 dashscope 的 compatible-mode，COPILOT_MODEL 填 qwen3.6-plus 或控制台给定的模型名）。
- 使用仓库提供的 copilot-qwen 启动脚本（或 copilot-qwen.ps1）来加载 env 并启动 copilot 客户端。
- 如需在代码中直接调用，参考上面的 curl/Python 示例并替换为你的 Key 与 model 名称。
- 若希望可视化本地消耗，把 usage-monitor-web 中的 providers.local.json 填写为 platform 的 usage/balance 接口，然后运行示例前端。

十一、注意事项与风险
---------------------
- 模型名、endpoint、pricing 随时可能更新，请优先参考阿里云 Model Studio 官方文档与控制台。
- 控制台链接经常要求登录；若在企业网络或受限网络下无法访问，请使用公司授权或 VPN 等方式访问控制台并获取密钥与计费信息。
- 合规与隐私：向模型发送的敏感数据（个人信息、秘钥、受保护资料）需按照公司政策脱敏或避免发送。

附录：关键链接与参考资料
-------------------------
- 阿里云 Model Studio 帮助中心（Qwen / DashScope 文档集合）：https://help.aliyun.com/zh/model-studio/
- DashScope OpenAI-compatible API 说明（兼容模式说明页面）：请在 Model Studio 帮助中心搜索 "OpenAI 兼容" 或 "compatible-mode"
- 阿里云控制台（需登录）：https://dashscope.console.aliyuncs.com/ 或 控制台变体（bailian.console.aliyun.com，用户提供）
- 社区/教程（示例列表）：若干社区文章与博客（汇总来源，可能包含实操示例与价格估算）

-- 结束 --

备注：本报告基于仓库内 README.md 的 Copilot 启动示例与公开网络搜索的资料汇总（含阿里云帮助中心与社区教程）。如需把报告进一步扩展为逐字段的 API 参数对照（每个 endpoint 的完整请求/响应示例、错误码列表、SDK 配置示例、以及 region-by-region 的定价表），请确认是否继续（将进一步访问/抓取更多官方页面与示例代码）。