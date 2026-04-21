# usage-monitor-web 使用教程

`usage-monitor-web` 是这个仓库里的一个**独立监控原型**。它不会替换你现在的 DeepSeek / Qwen 启动方式，而是在**不影响现有 API 部署和切换流程**的前提下，额外提供一个本地网页面板。

当前版本已经优先接入 **DeepSeek 官方余额接口**：

- 文档页：`https://api-docs.deepseek.com/zh-cn/api/get-user-balance`
- 方法：`GET`
- 路径：`/user/balance`

当前程序展示的重点字段是：

- `currency`
- `total_balance`
- `granted_balance`
- `topped_up_balance`

---

## 1. 现在这个原型能做什么

当前版本支持：

- 自动读取 `~/.copilot/deepseek.env`
- 自动读取 `~/.copilot/qwen.env`
- 自动识别：
  - `COPILOT_PROVIDER_BASE_URL`
  - `COPILOT_PROVIDER_API_KEY`
  - `COPILOT_MODEL`
- 对 DeepSeek 默认调用官方余额接口
- 在页面展示：
  - 可用状态
  - 币种
  - 总余额
  - 赠金余额
  - 充值余额
  - 接口状态
  - 最近检查时间

当前版本**还不支持**：

- DeepSeek token usage 统计接口
- 历史图表
- SQLite 持久化
- 桌面应用打包

---

## 2. 适合什么场景

这个版本适合你现在的目标：

1. 已经配置好了 DeepSeek API
2. 不想改现有 `copilot-deepseek.sh` / `copilot-qwen.sh`
3. 想先把 **DeepSeek 余额监控**做出来
4. 想先验证官方接口能不能直接用

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
          "Authorization": "Bearer ${apiKey}"
        }
      },
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
  ]
}
```

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

### 9.3 为什么页面里 Qwen 还是没有余额

因为当前这版计划已经收窄为：**先只围绕 DeepSeek 查询余额接口实现**。

Qwen 仍然保留在页面里，但默认没有接入官方余额接口。

---

## 10. 当前版本边界

为了保证不影响现有 API 部署流程，这个版本刻意保持了几个边界：

- 不改已有 provider env 文件结构
- 不改已有启动脚本
- 不劫持真实请求
- 不引入网页抓取
- 先只优先实现 DeepSeek 官方余额接口

---

## 11. 下一步最重要的事情

当前最重要的下一步不是继续发散架构，而是：

1. 确认 DeepSeek 余额接口持续可用
2. 继续找 DeepSeek 官方 usage/token 统计接口
3. 再决定是否扩展到 Qwen 或网页抓取 fallback

现在这版的目标很明确：

**先把 DeepSeek 余额监控稳定跑起来。**
