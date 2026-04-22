# usage-monitor-web - DeepSeek 使用监控面板

`usage-monitor-web` 是这个仓库里的一个独立监控原型。它不会替换你现在的 DeepSeek 启动方式，而是在不影响现有 API 部署和切换流程的前提下，额外提供一个本地网页面板，用于实时监控 DeepSeek API 的使用情况和余额。

## 功能特性

- **DeepSeek Usage 数据抓取**：自动抓取 DeepSeek 平台的使用数据
  - 总可用 Token 预估
  - 月度 Token 使用量
  - 总使用量统计
  - 当前 Token 余额
- **Web Token 支持**：支持通过网页 Token 进行鉴权
- **自动接口发现**：自动发现 DeepSeek 平台的 API 接口
- **本地网页界面**：提供简洁的本地监控面板
- **跨平台支持**：支持 Windows、Mac 和 Unix-like 系统

## 文件结构

```
usage-monitor-web/
├── README.md                    # 本文档
├── package.json                 # Node.js 项目配置
├── src/
│   ├── config.js               # 配置加载和解析
│   ├── collector.js            # 数据抓取和收集逻辑
│   └── server.js               # HTTP 服务器和 API 路由
├── config/
│   └── providers.example.json  # 配置文件示例
└── public/                     # 静态网页文件
```

### 主要文件说明

- **src/config.js**：负责加载环境变量配置、读取 provider 配置、构建请求上下文
- **src/collector.js**：核心数据抓取逻辑，包括 DeepSeek API 调用、HTML 解析、数据提取
- **src/server.js**：HTTP 服务器，提供 API 接口和静态文件服务
- **config/providers.example.json**：配置文件示例，可复制为 `providers.local.json` 进行自定义配置

## 快速开始

### 1. 环境准备

确保已安装 Node.js 18+ 版本。

### 2. 配置 DeepSeek 环境变量

创建 `~/.copilot/deepseek.env` 文件（或根据系统平台调整路径）：

```env
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekAPI密钥
COPILOT_MODEL=deepseek-reasoner

# 可选：如需访问 usage 网页接口，配置以下之一
COPILOT_DEEPSEEK_WEB_TOKEN=你的网页登录Token
COPILOT_DEEPSEEK_COOKIE=你的DeepSeek登录后Cookie
```

### 3. 安装依赖

```bash
cd usage-monitor-web
npm install
```

### 4. 启动服务

```bash
npm start
```

### 5. 访问监控面板

浏览器打开：`http://127.0.0.1:4173`

## 配置说明

### 环境变量路径

程序会自动识别当前系统平台，并使用相应的路径格式：

- **Windows**: `~\\.copilot\\deepseek.env`
- **Mac/Unix**: `~/.copilot/deepseek.env`

### 可用的环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `COPILOT_PROVIDER_BASE_URL` | DeepSeek API 基础 URL | 是 |
| `COPILOT_PROVIDER_API_KEY` | DeepSeek API 密钥 | 是 |
| `COPILOT_MODEL` | 使用的模型名称 | 是 |
| `COPILOT_DEEPSEEK_WEB_TOKEN` | 网页接口访问 Token | 可选 |
| `COPILOT_DEEPSEEK_COOKIE` | 登录后的 Cookie | 可选 |
| `COPILOT_PROVIDER_COOKIE` | 通用 Cookie 配置 | 可选 |

### 自定义配置文件

如果需要更高级的配置，可以创建 `config/providers.local.json`：

```bash
cp config/providers.example.json config/providers.local.json
```

然后编辑 `providers.local.json` 文件：

```json
{
  "pollingIntervalMs": 60000,
  "providers": [
    {
      "id": "deepseek",
      "enabled": true,
      "usageApi": {
        "url": "https://platform.deepseek.com/usage",
        "method": "GET",
        "responseType": "html",
        "headers": {
          "Authorization": "Bearer ${webToken}",
          "Cookie": "${sessionCookie}",
          "Referer": "https://platform.deepseek.com/usage"
        }
      },
      "deepseekUsageApis": {
        "summaryUrl": "https://platform.deepseek.com/api/v0/users/get_user_summary",
        "amountUrl": "https://platform.deepseek.com/api/v0/usage/amount?month=${month}&year=${year}",
        "costUrl": "https://platform.deepseek.com/api/v0/usage/cost?month=${month}&year=${year}"
      },
      "parser": {
        "usage": {
          "totalTokensPath": "data.biz_data.total_available_token_estimation",
          "promptTokensPath": "data.biz_data.monthly_token_usage",
          "completionTokensPath": "data.biz_data.total_usage",
          "requestCountPath": "data.biz_data.current_token"
        }
      }
    }
  ]
}
```

### 配置文件查找顺序

程序按以下顺序查找配置文件：
1. 环境变量 `USAGE_MONITOR_CONFIG`
2. `usage-monitor-web/config/providers.local.json`
3. `~/.copilot/usage-monitor.providers.json`

如果未找到配置文件，将使用内置的 DeepSeek 默认配置。

## API 接口

监控服务提供以下 HTTP API：

### `GET /api/providers`
获取当前配置的 providers 信息。

### `GET /api/snapshot`
获取最新的监控快照数据。

参数：
- `refresh=1`：强制刷新数据（默认使用缓存）

### `GET /api/config-example`
获取配置文件示例。

## DeepSeek 数据抓取流程

1. **鉴权准备**：从环境变量读取 Token 或 Cookie
2. **访问 Usage 页面**：请求 `https://platform.deepseek.com/usage`
3. **自动发现 API**：从页面中提取 API 接口地址
4. **并行请求**：同时获取以下数据：
   - `GET /api/v0/users/get_user_summary`：用户概要信息
   - `GET /api/v0/usage/amount?month={month}&year={year}`：月度用量
   - `GET /api/v0/usage/cost?month={month}&year={year}`：月度成本
5. **数据解析**：提取关键指标并返回给前端

## 数据字段说明

### Usage 数据字段

| 字段 | 说明 | 数据路径 |
|------|------|----------|
| 总可用 Token 预估 | 预估的可用 Token 总量 | `data.biz_data.total_available_token_estimation` |
| 月度 Token 使用量 | 当前月度的 Token 使用量 | `data.biz_data.monthly_token_usage` |
| 总使用量 | 累计总使用量 | `data.biz_data.total_usage` |
| 当前 Token | 当前剩余 Token | `data.biz_data.current_token` |

## 常见问题

### 1. 页面打开但 DeepSeek 余额没显示

检查以下配置：
1. `~/.copilot/deepseek.env` 文件是否存在
2. `COPILOT_PROVIDER_API_KEY` 是否正确
3. `COPILOT_PROVIDER_BASE_URL` 是否正确（通常为 `https://api.deepseek.com/v1`）

### 2. 页面显示接口报错

可能原因：
1. API Key 无效或过期
2. 网络请求被拦截
3. DeepSeek API 接口结构发生变化
4. Cookie 失效需要重新登录

### 3. 如何获取 DeepSeek Web Token

1. 登录 DeepSeek 平台网页版
2. 打开浏览器开发者工具（F12）
3. 在 Network 标签页中找到 API 请求
4. 从请求头中复制 `Authorization: Bearer <token>` 的 token 部分

### 4. 支持其他 AI 提供商吗？

当前版本仅支持 DeepSeek。如果需要支持其他提供商，需要修改代码添加对应的抓取逻辑。

## 开发模式

使用开发模式启动，支持文件变更自动重启：

```bash
npm run dev
```

## 技术依赖

- **Node.js**: >= 18.0.0
- **playwright**: 网页渲染和自动化测试
- **jsdom**: HTML 解析和 DOM 操作

## 注意事项

1. 本项目仅为监控原型，不保证生产环境稳定性
2. 所有敏感信息（API Key、Token 等）仅保存在本地环境变量文件中
3. 定期检查 DeepSeek API 接口是否有变化，必要时更新配置文件
4. 本项目不会修改现有的 Copilot CLI 启动流程

## 故障排查

### 检查环境变量加载

启动服务时，控制台会显示加载的环境变量文件路径，确认是否正确加载。

### 检查网络连接

确保可以访问 DeepSeek 相关域名：
- `https://api.deepseek.com`
- `https://platform.deepseek.com`

### 查看控制台日志

启动服务时注意控制台输出的警告信息，通常会提示配置问题。

### 手动测试 API

可以使用 curl 测试 DeepSeek API 是否正常：

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.deepseek.com/v1/user/balance"
```