# Qwen 信息抓取与监控计划

## 目标

在不破坏现有 DeepSeek 流程的前提下，给 `usage-monitor-web` 增加一条面向 Qwen 的信息采集链路，优先通过阿里云百炼控制台的登录后页面抓取 usage、balance、配额和监控信息。

## 当前状态

- `usage-monitor-web` 已有独立的 provider 配置、轮询快照和前端展示框架。
- DeepSeek 已接入余额接口，Qwen 现在也有默认页面源和登录态提示。
- 现有代码按平台区分 Windows / Mac / Unix-like 的 `~/.copilot/*.env` 路径。
- Qwen 的可用信息主要来自阿里云百炼控制台，不是公开的无登录 REST 接口。

## 登录与验证码处理原则

- 不在仓库保存阿里云账号密码，也不自动输入验证码。
- 由用户先在本机浏览器手动登录阿里云，再把登录后的 Cookie/请求头写入本地配置。
- 若登录过程中触发手机验证码，仍由用户手动完成。
- Cookie 失效后，重新登录并刷新本地配置即可。
- 页面抓取失败时，collector 返回 `auth_required` / `login_required` 一类可读错误，不静默跳过。

## 计划

1. 基于官方控制台页面确认 Qwen 可见字段和稳定入口，重点看免费额度、模型用量、账单和模型监控页。
2. 以“手动登录 + 本地 session 复用”为前提，继续完善 Cookie/请求头配置，不把账号密码和验证码自动化写进代码。
3. 优先复用 DeepSeek 的配置/抓取结构；如果有稳定 JSON 源就用 JSON，否则用 HTML/DOM 解析作为 fallback。
4. 保持 DeepSeek 行为不受影响，把 Qwen 采集逻辑落到 `usage-monitor-web` 的 provider、collector 和前端展示中。
5. 让 Qwen 面板显示可用状态、登录失效提示、抓取页面来源和刷新延迟，避免一直显示 `skipped`。
6. 同步更新仓库文档，说明 Qwen 抓取页面、登录/验证码处理、前置条件和注意事项。

## Todo

- 盘点 Qwen 侧可用的信息来源：usage、balance、模型列表、账号/配额页面
- 设计 Qwen 登录策略：手动登录后复用本地 session/cookie
- 扩展 `usage-monitor-web/src/config.js`
- 扩展 `usage-monitor-web/src/collector.js`
- 扩展 `usage-monitor-web/public/app.js`
- 更新 `usage-monitor-web/config/providers.example.json`
- 更新 `usage-monitor-web/README.md` 和仓库级说明文档
- 补充必要的字段解析与错误提示
- 记录 Qwen 页面 URL、登录前置条件、验证码处理和延迟特性

## 约束与注意事项

- 不改现有 `copilot-deepseek.sh` / `copilot-qwen.sh` 的启动方式。
- 不把密钥或个人配置写回仓库。
- 如果 Qwen 页面依赖登录态或控制台权限，要明确记录为前置条件。
- 页面抓取必须保留容错：抓不到时返回可解释的错误，而不是静默失败。
