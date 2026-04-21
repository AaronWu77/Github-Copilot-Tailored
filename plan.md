# 联合改进计划：DeepSeek + Qwen 的 Token/用量抓取方案

## 结论先行

1. **DeepSeek 有 usage 页面**：`https://platform.deepseek.com/usage`，但该地址返回前端壳页面，真实数据需要登录态与前端请求后才能拿到。
2. DeepSeek 官方 API 文档明确可直接拿到：
   - 余额：`GET /user/balance`
   - 单次请求 token：在 Chat/Completion 响应 `usage` 字段里
3. Qwen（DashScope）已明确可用 OpenAI-compatible `/chat/completions`，单次请求 token 同样应以响应 `usage` 为主；账户级余额/账单接口需继续确认。

所以总体策略是：**请求级 token 统一从 API 响应 usage 抓取；账户级信息按 provider 分轨接入（DeepSeek 已接余额，Qwen 待确认）；DeepSeek usage 页面作为增强数据源。**

---

## 一、DeepSeek 方案（详细）

### A. 已有能力（保留）

- 余额接口：`GET /user/balance`
- 展示字段：`is_available`、`balance_infos[].currency`、`total_balance`、`granted_balance`、`topped_up_balance`

### B. 新增：DeepSeek Token 抓取（API usage）

从 DeepSeek Chat/Completion 响应中记录：

- `usage.prompt_tokens`
- `usage.completion_tokens`
- `usage.total_tokens`
- `usage.prompt_cache_hit_tokens`
- `usage.prompt_cache_miss_tokens`
- `usage.completion_tokens_details.reasoning_tokens`（若存在）

并按日聚合：

- 今日请求数
- 今日输入/输出/总 token
- 今日缓存命中/未命中 token
- 今日 reasoning token

### C. 新增：DeepSeek usage 页面抓取（增强）

因为 `platform.deepseek.com/usage` 不是直接 JSON API，计划增加“页面采集器”：

1. 使用浏览器自动化（Playwright）访问 usage 页面
2. 复用登录态（本地浏览器 profile 或 cookie 注入）
3. 在页面加载后抓取两类数据源：
   - DOM 中可见统计卡片
   - 页面发起的 XHR/fetch 响应（优先）
4. 将页面结果与 API usage 聚合结果并列展示

### D. DeepSeek 对账策略

- API usage 聚合：主数据源（请求级）
- usage 页面：辅助校验源（账户视角）
- 当两者偏差超过阈值时，标记“待核对”

---

## 二、Qwen 方案（详细，分轨）

### A. 请求级 token 抓取（第一优先）

基于 OpenAI-compatible `/chat/completions` 响应 `usage` 采集：

- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `model`
- `timestamp`
- `request_id`（若返回）

并按日聚合：

- 今日请求数
- 今日输入/输出/总 token
- 今日估算费用（按配置单价）

### B. 账户级信息（条件接入）

1. 优先确认 DashScope/Model Studio 是否公开余额/账单 API
2. 若确认：接入账户余额展示
3. 若未确认：UI 显示“账户余额接口未接通”，仅展示 usage 聚合

---

## 三、统一架构（DeepSeek + Qwen）

### 1) 数据采集层

- `collectors/deepseek/balance-api`
- `collectors/deepseek/usage-api-response`
- `collectors/deepseek/usage-page`（新增）
- `collectors/qwen/usage-api-response`
- `collectors/qwen/balance-api`（可选）

### 2) 存储与聚合层

- 请求级表（或 JSON）：逐请求 usage 记录
- 日聚合表：按 provider/model/date 聚合
- 对账表：DeepSeek API usage vs usage 页面差异

### 3) 展示层

DeepSeek 卡片：
- 余额（已实现）
- 今日 token 统计（新增）
- usage 页面抓取状态（新增）

Qwen 卡片：
- 今日 token 统计（新增）
- 费用估算（新增）
- 余额状态（可选）

---

## 四、实施阶段

### 阶段 1：DeepSeek token usage 接入

- 在现有服务中新增 DeepSeek usage 记录结构
- 新增 DeepSeek 今日 token 看板

### 阶段 2：Qwen token usage 接入

- 新增 Qwen usage 记录与日聚合
- 新增 Qwen 今日 token + 估算费用看板

### 阶段 3：DeepSeek usage 页面采集

- 引入 Playwright 采集器
- 打通登录态复用
- 抓取 DOM + 网络响应

### 阶段 4：对账与告警

- DeepSeek API usage 与 usage 页面数据对账
- 异常阈值告警（可选）

### 阶段 5：文档收敛

- 更新 `usage-monitor-web/README.md`
- 更新配置示例（DeepSeek/Qwen 分轨）

---

## 五、配置变更规划

新增配置建议：

- `deepseek.usagePage.url`
- `deepseek.usagePage.authMode`（cookie/profile）
- `deepseek.usagePage.extractor`（dom/network）
- `qwen.pricing.inputPerMillion`
- `qwen.pricing.outputPerMillion`
- `usageMetering.enabledProviders`

---

## 六、风险与边界

1. DeepSeek usage 页面抓取依赖登录态与前端结构，稳定性弱于 API
2. Qwen 余额接口公开性不确定，可能只能先做 usage 聚合
3. 本地 usage 聚合只覆盖经过本系统的请求，不一定等于账号全量账单

---

## 七、Todo 列表（联合）

- 接入 DeepSeek 请求级 usage 记录与日聚合
- 接入 Qwen 请求级 usage 记录与日聚合
- 新增 Qwen 费用估算展示
- 增加 DeepSeek usage 页面采集器（Playwright）
- 实现 DeepSeek API usage 与页面 usage 对账
- 更新 README 与配置模板
