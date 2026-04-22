# DeepSeek Usage 页面重构计划（Usage-only）

## 问题与目标
- 现有 `usage-monitor-web` 已能抓取 DeepSeek 的部分 usage/balance，但结构仍是通用卡片，未按 DeepSeek 官方 usage 页的数据形态呈现。
- 用户已确认采用 **仅保留 Usage** 方案：DeepSeek 页面改为 usage 主导展示，移除 DeepSeek balance 区块与其依赖路径。
- 目标是复现你给出的核心结构：充值余额、本月消费、本月用量折线/柱状趋势，以及 deepseek-chat / deepseek-reasoner 的 API 请求次数与 TOKENS 图表。

## 已知数据结构（输入）
- `GET /api/v0/users/get_user_summary`：账户级汇总（钱包余额、monthly_costs、monthly_token_usage、total_available_token_estimation）。
- `GET /api/v0/usage/amount?month={m}&year={y}`：按天/按模型的 token 与请求用量（`days[].data[].usage[]`）。
- `GET /api/v0/usage/cost?month={m}&year={y}`：按天/按模型的费用构成（`days[].data[].usage[]`，type 为费用维度）。

## 实现策略
1. **采集层（collector）改造为 DeepSeek 专用 usage 聚合**
   - 在一次刷新周期中统一计算当前年月（`new Date()`）并动态请求 `amount` + `cost` + `get_user_summary`。
   - 新增 DeepSeek usage 聚合函数：将三个接口归一为单一 `deepseekUsage` 结构（summary + charts + modelBreakdown）。
   - 对接口返回 `code != 0`、缺字段、空 days 的场景输出显式错误状态（不静默）。

2. **数据模型（后端输出）升级**
   - 为 DeepSeek provider 输出专属字段：
     - `summary`: 充值余额、赠金余额、总可用 token 估算、本月消费、本月 token 用量
     - `charts.monthlyDaily`: 本月逐日 token / 请求 / 费用
     - `charts.modelDaily`: 按模型拆分（deepseek-chat、deepseek-reasoner）的请求次数与 tokens
   - 保持 qwen 路径不受影响，DeepSeek 与 Qwen 分流处理。

3. **前端页面重构（DeepSeek usage 页面化）**
   - 在 `public/index.html` / `public/app.js` 中为 DeepSeek 渲染专用布局：
     - 顶部 KPI（充值余额、本月消费、本月用量）
     - 图表区 A：本月 API 请求次数（日维度）
     - 图表区 B：本月 TOKENS（日维度）
     - 图表区 C：按模型（chat/reasoner）对比
   - 图表优先采用无新增依赖方案（原生 SVG/Canvas）以降低风险；如后续需要可替换为轻量图表库。

4. **Usage-only 收敛（DeepSeek）**
   - DeepSeek 卡片删除 Balance 展示与文案分支。
   - 若确认 `get_user_summary` + `cost/amount` 已覆盖余额含义，则 DeepSeek 不再依赖 `${baseUrl}/user/balance`。
   - Qwen 仍保留原 usage+balance 双通道，不做行为变更。

5. **文档同步**
   - 更新 `usage-monitor-web/README.md`：新增 DeepSeek usage 数据源说明、token/cookie 配置、图表字段映射。
   - 更新仓库 `README.md` 与 `doc/plan.md` 的变更日志与实现说明。

## 待办（执行顺序）
1. 设计并落地 `deepseekUsage` 统一数据结构与字段约定。
2. 在 `collector.js` 中实现按当前年月动态请求 `amount/cost` 的拼接逻辑。
3. 实现 `amount/cost/get_user_summary` 三路聚合与错误分类。
4. 改造 snapshot 输出，加入 DeepSeek 专属 summary/charts 数据。
5. 重构前端 DeepSeek 卡片模板与渲染函数（Usage-only）。
6. 移除 DeepSeek balance UI 与对应文案分支。
7. 文档更新与示例配置同步（包含 token/cookie 与字段映射）。

## 关键决策
- **已确认**：DeepSeek 采用 Usage-only（删除其 Balance 展示）。
- 月份与年份由系统时间实时计算，避免手动改 query 参数。
- 以你提供的真实接口结构作为解析基线，不再依赖模糊自动识别。

## 风险与应对
- Web token 失效：在 warnings 中显式提示并给出 `COPILOT_DEEPSEEK_WEB_TOKEN` 指引。
- 月中数据缺口：图表按日期补零，避免断图与错位。
- 字段波动：解析层增加字段兜底路径与严格状态码检查。
