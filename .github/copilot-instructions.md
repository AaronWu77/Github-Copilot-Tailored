# Copilot Instructions

## 项目说明

本仓库用于在本地通过 OpenAI-compatible API 配置 GitHub Copilot CLI，当前主要覆盖 DeepSeek 与 Qwen 两个 provider，并支持 Windows、macOS、Linux 三个平台。

## 仓库约定

- `README.md` 是权威文档；修改脚本、模板或说明时必须与 README 保持一致。
- provider 配置保存在用户本地 `~/.copilot/*.env`，仓库中不得存储密钥或用户私有配置。
- 启动脚本应保持极简，只负责加载对应 `.env` 并启动 `copilot`。
- `usage-monitor-web/` 是可选的独立监控工具，不得破坏主流程的 provider 切换方案。
- provider、脚本名、`.env` 文件名必须一一对应，不能混用。

## Plan 模式约束

1. 进入 plan 模式后，任何方案都不能直接定稿。
2. 每形成一个计划步骤、设计决策或执行方案，必须先调用 `ask_user` 逐项询问用户是否接受该方案。
3. 只有当前步骤得到用户明确确认后，才能进入下一个步骤。
4. 所有计划细节都确认后，除了更新会话内计划文件，还必须在仓库根目录创建或更新 `/doc/plan.md`，供用户审阅。

## `/doc/plan.md` 固定结构

`/doc/plan.md` 必须按以下顺序编写：

1. **功能目的**：说明要解决的问题、目标和范围边界。
2. **TodoList**：列出需要执行的任务拆分。
3. **具体执行方案**：说明每个阶段如何实施、涉及哪些文件或模块、如何落地。

## Autopilot 模式约束

1. 进入 autopilot 模式后，不得直接开始执行。
2. 每次准备实施前，必须先调用 `ask_user`，询问是否按当前仓库中的 `/doc/plan.md` 执行。
3. 只有在用户明确同意后，才能继续修改代码、运行命令或推进任务。
4. 如果 `/doc/plan.md` 不存在、已过期，或用户要求调整方案，必须先回到计划确认流程。
5. 完成修改后，提醒用户运行 `/review`。

## `/review` 约束

1. 当用户要求执行 `/review` 时，先检查 `/doc/plan.md` 与本次对话中的代码改动是否一致。
2. 如果审查通过，则在本文档末尾维护简要更新日志；若尚无更新日志，则主动创建。
3. 如果审查发现问题，调用 `ask_user` 反馈问题，并在 `/doc/plan.md` 追加代码审查部分，说明问题内容以及受影响的 TodoList 项；最后提醒用户重新执行 `/plan` 规划修复方案。

## 更新日志

**v1**
- 重写仓库级 `copilot-instructions.md`
- 纳入 Plan、`/doc/plan.md`、Autopilot、`/review` 约束
