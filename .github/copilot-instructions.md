# Copilot Instructions (2026-04)

## 项目核心说明

本仓库用于在本地通过 OpenAI-compatible API（如 DeepSeek、Qwen）配置 Copilot CLI，支持多平台（Windows/Mac/Linux）一键切换。

- 每个 provider 独立配置（.env 文件）和独立启动脚本，互不干扰。
- 不在仓库存储密钥，所有敏感信息仅保存在用户本地 `~/.copilot/*.env`。
- 启动脚本极简：只加载对应 .env 并 exec copilot，不做多余逻辑。
- 文档和脚本保持同步，README.md 为权威配置说明。

## 主要目录结构

- `copilot-deepseek.sh` / `copilot-qwen.sh`：Unix-like 启动脚本范例
- `usage-monitor-web/`：本地用量监控原型，完全独立于主流程

## 快速使用流程

1. 按 README.md 指引，分别为 DeepSeek/Qwen 创建 .env 文件（含 API Key、Base URL、Model 等）。
2. 按平台生成对应启动脚本（Windows PowerShell、Mac/Linux zsh/bash）。
3. 将脚本目录加入 PATH，直接用 `copilot-deepseek` 或 `copilot-qwen` 启动。
4. 可用 usage-monitor-web/ 查看本地 token 用量、余额等信息，无需改动主流程。

## 关键约定

- provider 名称、脚本、.env 文件一一对应，互不混用。
- 不在仓库内存储任何密钥或用户配置。
- usage-monitor-web/ 仅为可选工具，不影响主流程。
- 任何平台下均可用同一思路配置和切换。

## 参考

- 详细平台配置、常见问题、usage-monitor-web 用法请见 README.md。
- 如需更新脚本或文档，务必保持两者同步。
