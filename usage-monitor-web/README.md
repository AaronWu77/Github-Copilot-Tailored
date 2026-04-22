# usage-monitor-web 使用教程

## 更新日志（文档头部维护）

- 当前更新次数：5
- v5：DeepSeek 切换为 Usage-only 数据流：按系统当前年月请求 `get_user_summary` + `usage/amount` + `usage/cost`，前端新增请求数/TOKENS图表并移除 DeepSeek balance 展示。
- v4：DeepSeek usage 增加 Web Token 支持（`COPILOT_DEEPSEEK_WEB_TOKEN`），默认携带 `Authorization: Bearer <webToken>` + Cookie，并补充 deepseek.com 站点下接口自动发现。
- v3：DeepSeek usage 新增自动抓取模式（默认请求 `https://platform.deepseek.com/usage` 并自动发现 `get_usr_summary/amount/cost` 等接口），内置 `biz_data` 结构解析。
- v2：修复 DeepSeek Cookie 接入链路（默认请求头注入 Cookie）、修复 providers.example.json 结构错误、按 provider 显示登录态提示文案。
- v1：接入 Qwen 控制台 RPC 抓取与登录态检测，保留 DeepSeek 官方余额接口流程。

---

`usage-monitor-web` 是这个仓库里的一个**独立监控原型**。它不会替换你现在的 DeepSeek / Qwen 启动方式，而是在**不影响现有 API 部署和切换流程**的前提下，额外提供一个本地网页面板。

当前版本已经把 DeepSeek 迁移到 **Usage-only** 结构，同时保留 **Qwen 百炼控制台 RPC 抓取能力**：

- `GET /api/v0/users/get_user_summary`
- `GET /api/v0/usage/amount?month={m}&year={y}`
- `GET /api/v0/usage/cost?month={m}&year={y}`

当前程序展示的重点字段是：

- `currency`
- `total_balance`
- `granted_balance`
- `topped_up_balance`
- HTML / JSON 两种响应模式
- Qwen 的 `ListBillingQuotas` RPC 直连
- 登录页检测与提示

---

## 1. 现在这个原型能做什么

当前版本支持：

- 自动读取 `~/.copilot/deepseek.env`
- 自动读取 `~/.copilot/qwen.env`
- 会先识别当前系统是 Windows 还是 Mac，再决定使用哪种默认路径写法
- 自动识别：
  - `COPILOT_PROVIDER_BASE_URL`
  - `COPILOT_PROVIDER_API_KEY`
  - `COPILOT_MODEL`
- 如果是 DeepSeek，还会读取 `COPILOT_DEEPSEEK_COOKIE` / `COPILOT_PROVIDER_COOKIE`，并可选读取 `COPILOT_DEEPSEEK_WEB_TOKEN`（用于 usage 网页接口鉴权）
- 如果是 Qwen，还会读取 `COPILOT_QWEN_COOKIE` / `COPILOT_PROVIDER_COOKIE`
- DeepSeek 默认按 Usage-only 模式采集（不再渲染 DeepSeek balance 卡片）
- 对 Qwen 默认使用百炼控制台 RPC 作为抓取源
- 在页面展示：
  - 可用状态
  - 币种
  - 总余额
  - 赠金余额
  - 充值余额
  - Usage 来源
  - Balance 来源
  - Usage 基础指标
  - 接口状态
  - 最近检查时间

当前版本**还不支持**：

- 直接解析 Qwen 控制台里的所有列表型 UI
- 历史图表
- SQLite 持久化
- 桌面应用打包

---

## 2. 适合什么场景

这个版本适合你现在的目标：

1. 已经配置好了 DeepSeek API
2. 不想改现有 `copilot-deepseek.sh` / `copilot-qwen.sh`
3. 想先把 **DeepSeek 余额监控**做出来
4. 想用 **Qwen 百炼控制台 RPC** 做余额或用量采集

---

## 3. 运行前提

### 3.1 Node.js

建议 Node.js 18+。

### 3.2 DeepSeek env 文件

确保下面这个文件存在：

- `~/.copilot/deepseek.env`

并且至少包含：

```env
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekKey
COPILOT_MODEL=deepseek-reasoner
# 如需登录态，可选填：
COPILOT_DEEPSEEK_COOKIE=你的DeepSeek登录后Cookie
# 如需访问 usage 网页接口，可选填（优先于从 Cookie 自动提取 token）：
COPILOT_DEEPSEEK_WEB_TOKEN=你的网页登录Token
```

> 当前版本默认使用 `${baseUrl}/user/balance`，所以如果你的 `baseUrl` 是 `https://api.deepseek.com/v1`，程序就会请求：
>
> `https://api.deepseek.com/v1/user/balance`

---

## 4. 最短启动方式

进入目录：

```powershell
Set-Location .\usage-monitor-web
```

启动：

```powershell
npm start
```

浏览器打开：

```text
http://127.0.0.1:4173
```

如果你的 DeepSeek API Key 可用，页面会自动尝试请求官方余额接口。

---

## 5. 当前默认行为

即使你没有手动填写 `providers.local.json`，当前程序也会对 `deepseek` 自动使用下面这组默认配置：

```json
{
  "balanceApi": {
    "url": "${baseUrl}/user/balance",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer ${apiKey}"
    }
  },
  "parser": {
    "balance": {
      "availablePath": "is_available",
      "currencyPath": "balance_infos.0.currency",
      "totalBalancePath": "balance_infos.0.total_balance",
      "grantedBalancePath": "balance_infos.0.granted_balance",
      "toppedUpBalancePath": "balance_infos.0.topped_up_balance"
    }
  }
}
```

也就是说，**DeepSeek 余额现在已经不需要你手动猜 URL 了**。

---

## 6. 如果你要使用 `providers.local.json`

复制示例文件：

```powershell
Copy-Item .\config\providers.example.json .\config\providers.local.json
```

当前推荐把 DeepSeek 部分写成：

```json
{
  "pollingIntervalMs": 60000,
  "providers": [
    {
      "id": "deepseek",
      "enabled": true,
      "usageApi": {
        "url": "",
        "method": "GET",
        "headers": {
          "Authorization": "Bearer ${apiKey}",
          "Cookie": "${sessionCookie}"
        }
      },
      "balanceApi": {
        "url": "${baseUrl}/user/balance",
        "method": "GET",
        "headers": {
          "Authorization": "Bearer ${apiKey}",
          "Cookie": "${sessionCookie}"
        }
      },
      "parser": {
        "balance": {
          "availablePath": "is_available",
          "currencyPath": "balance_infos.0.currency",
          "totalBalancePath": "balance_infos.0.total_balance",
          "grantedBalancePath": "balance_infos.0.granted_balance",
          "toppedUpBalancePath": "balance_infos.0.topped_up_balance"
        }
      }
    }
  ]
}
```

Qwen 部分建议写成：

```json
{
  "id": "qwen",
  "enabled": true,
  "workspaceId": "cn-beijing",
  "region": "cn-beijing",
  "collina": "",
  "usageApi": {
    "preflightUrl": "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/usage-statistics",
    "url": "https://bailian.console.aliyun.com/data/api.json",
    "method": "POST",
    "responseType": "json",
    "bodyType": "form",
    "form": {
      "action": "ListBillingQuotas",
      "product": "bailian",
      "params": {
        "WorkspaceId": "${workspaceId}"
      },
      "sec_token": "${secToken}",
      "umid": "${umid}",
      "region": "${region}",
      "collina": "${collina}"
    },
    "headers": {
      "Cookie": "${sessionCookie}",
      "User-Agent": "${userAgent}",
      "Referer": "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/usage-statistics",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "Source": "bailian"
    }
  },
  "balanceApi": {
    "preflightUrl": "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/free-quota",
    "url": "https://bailian.console.aliyun.com/data/api.json",
    "method": "POST",
    "responseType": "json",
    "bodyType": "form",
    "form": {
      "action": "ListBillingQuotas",
      "product": "bailian",
      "params": {
        "WorkspaceId": "${workspaceId}"
      },
      "sec_token": "${secToken}",
      "umid": "${umid}",
      "region": "${region}",
      "collina": "${collina}"
    },
    "headers": {
      "Cookie": "${sessionCookie}",
      "User-Agent": "${userAgent}",
      "Referer": "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/free-quota",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "Source": "bailian"
    }
  },
  "parser": {
    "usage": {
      "totalTokensPath": "data.BillingQuotas",
      "promptTokensPath": "data.BillingQuotas",
      "completionTokensPath": "data.BillingQuotas",
      "requestCountPath": "data.BillingQuotas"
    },
    "balance": {
      "availablePath": "data.IsCDTLocked",
      "currencyPath": "data.BillingQuotas.0.QuotaUnit",
      "totalBalancePath": "data.BillingQuotas.0.QuotaValue",
      "grantedBalancePath": "data.BillingQuotas.0.UsedQuotaValue",
      "toppedUpBalancePath": "data.BillingQuotas.0.QuotaValue"
    }
  }
}
```

> `collina` 对应浏览器里 `aliyunbuy_uadata` / `RISK_INFO.GETUA()` 生成的风控值；如果不填，接口可能仍然只返回错误码或空值。

---

## 7. 页面上每个余额字段是什么意思

### `可用状态`

来自：

- `is_available`

表示这个余额接口当前是否可用。

### `币种`

来自：

- `balance_infos.0.currency`

通常是：

- `CNY`
- `USD`

### `总余额`

来自：

- `balance_infos.0.total_balance`

表示总的可用余额。

### `赠金余额`

来自：

- `balance_infos.0.granted_balance`

表示未过期赠金余额。

### `充值余额`

来自：

- `balance_infos.0.topped_up_balance`

表示实际充值余额。

---

## 8. 配置文件查找顺序

程序会按这个顺序查找配置：

1. 环境变量 `USAGE_MONITOR_CONFIG`
2. `usage-monitor-web/config/providers.local.json`
3. `~/.copilot/usage-monitor.providers.json`

如果没找到，也不影响 DeepSeek 默认余额接口生效，因为它已经内置在程序里。

> 平台说明：程序会先判断当前系统是否为 Windows / Mac，再选择 provider `.env` 的默认路径写法。  
> 在 Windows 上会优先使用 `$HOME\\.copilot\\deepseek.env`、`$HOME\\.copilot\\qwen.env`；在 Mac 上会优先使用 `~/.copilot/deepseek.env`、`~/.copilot/qwen.env`。

---

## 9. 常见问题排查

### 9.1 页面打开了，但 DeepSeek 余额还是没出来

优先检查：

1. `~/.copilot/deepseek.env` 是否存在
2. `COPILOT_PROVIDER_API_KEY` 是否正确
3. `COPILOT_PROVIDER_BASE_URL` 是否正确

推荐值通常是：

```env
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
```

### 9.2 页面显示接口报错

通常是以下原因之一：

1. API Key 无效
2. 网络请求被拦截
3. 返回结构发生变化
4. Cookie 失效或页面需要重新登录
5. 页面已打开，但脚本里的接口入口没有被当前规则识别到

### 9.3 为什么页面里 Qwen 还是没有余额

Qwen 的控制台 RPC 仍然需要登录态和页面风控值；如果你没有在本地配置里提供可访问会话的 Cookie，请先在浏览器里手动登录阿里云，然后把登录后的 Cookie 复制到 `~/.copilot/qwen.env` 的 `COPILOT_QWEN_COOKIE`，再把 `aliyunbuy_uadata` / `collina` 填到 `COPILOT_QWEN_COLLINA`。如果现在显示 `需登录`，说明 Cookie 已失效、权限不够，或者 `collina` 还没补上。

Qwen 现在默认优先走百炼控制台的 `ListBillingQuotas` RPC；如果它返回登录页或权限错误，就先检查本地 Cookie 是否仍然有效。

如果页面直接提示“系统繁忙，请刷新页面重试”，那说明当前控制台页面态还没准备好数据，不是前端把 cookie 解析坏了，刷新后再抓即可。

---

## 10. 当前版本边界

为了保证不影响现有 API 部署流程，这个版本刻意保持了几个边界：

- 不改已有 provider env 文件结构
- 不改已有启动脚本
- 不劫持真实请求
- 支持网页抓取，但必须由本地配置提供可访问的数据源
- 先优先实现 DeepSeek 官方余额接口和 Qwen 页面抓取骨架
- 遇到手机验证码时，由用户手动完成登录，程序只复用登录后的 session/cookie

---

## 11. 下一步最重要的事情

当前最重要的下一步是：

1. 确认 DeepSeek 余额接口持续可用
2. 补齐 Qwen 页面抓取的本地配置
3. 再决定是否把 Qwen usage 接到控制台监控或 Prometheus 数据源

现在这版的目标很明确：

**把 DeepSeek 和 Qwen 的页面/接口采集入口都先打通。**

---

## 12. Qwen 页面抓取怎么配

Qwen 的余额和用量主要来自阿里云百炼控制台的控制台 RPC，不是公开的匿名 API。当前原型已经支持：

- 在 `providers.local.json` 里配置 `workspaceId`、`region`、`collina` 和 `responseType: "json"`
- 让服务器端先抓 `usage-statistics` / `free-quota` 页面，再直连百炼控制台的 `ListBillingQuotas` RPC
- 用 `parser` 里的 `*Path` 汇总 `BillingQuotas`
- 如果页面需要验证码登录，先在浏览器手动完成登录，再把 Cookie 放进本地配置；程序不会替你输入账号密码或验证码

如果你要抓 Qwen 免费额度，推荐先从：

- `https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/free-quota`

如果你要抓 Qwen 用量，推荐先从：

- `https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/usage-statistics`
- `https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-telemetry`

这两个页面一般都需要登录态；如果本地抓取返回登录页，请在本地配置里补充能访问页面的 Cookie，或者改用你能访问的内部数据源。
