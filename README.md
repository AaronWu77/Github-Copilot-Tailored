# GitHub Copilot CLI API配置教程（Windows / Mac / Linux）

## 更新日志（维护在文档开头）

- 当前更新次数：4
- v4：usage-monitor-web 的 DeepSeek 面板改为 Usage-only，按当月 `get_user_summary/amount/cost` 重建余额与图表数据。
- v3：usage-monitor-web 增加 DeepSeek Web Token 配置（`COPILOT_DEEPSEEK_WEB_TOKEN`），用于 usage 网页接口鉴权。
- v2：usage-monitor-web 新增 DeepSeek usage 自动抓取与 `biz_data` 解析（兼容 get_usr_summary/amount/cost 等接口）。
- v1：补充 usage-monitor-web DeepSeek Cookie 登录态说明与故障修复指引（默认请求头注入 Cookie、按 provider 区分提示文案）。

---

这份教程，目标是在本地把自己的API模型配置到 Copilot CLI 中：

本教程以下面两个公司的产品为例
- DeepSeek
- Qwen

最终效果：

1. 你有两份独立的环境变量文件
2. 你有两个独立启动脚本
3. 你可以随时切换模型
4. 你也可以同时开两个终端分别运行

> 安全提示：如果你曾经把 API Key 明文写到终端或对话里，请先去对应平台重新生成新的 Key，再把旧 Key 作废。

---

## 第 1 步：准备目录

### Windows（PowerShell）已验证

```powershell
New-Item -ItemType Directory -Force "$HOME\.copilot" | Out-Null
New-Item -ItemType Directory -Force "$HOME\bin" | Out-Null
```

### Mac（zsh / bash）已验证

```bash
mkdir -p ~/.copilot ~/bin
```

### Linux（bash / zsh）未验证

```bash
mkdir -p ~/.copilot ~/bin
```

---

## 第 2 步：创建 DeepSeek 配置文件

### Windows（PowerShell）

```powershell
@'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekKey
COPILOT_MODEL=deepseek-reasoner
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096
'@ | Set-Content -Encoding UTF8 "$HOME\.copilot\deepseek.env"
```

### Mac（zsh / bash）

```bash
cat > ~/.copilot/deepseek.env <<'EOF'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekKey
COPILOT_MODEL=deepseek-reasoner
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096
EOF
```

### Linux（bash / zsh）

```bash
cat > ~/.copilot/deepseek.env <<'EOF'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekKey
COPILOT_MODEL=deepseek-reasoner
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096
EOF
```

### 说明

- `COPILOT_PROVIDER_TYPE=openai`：因为 DeepSeek 使用 OpenAI-compatible 接口
- `COPILOT_PROVIDER_BASE_URL`：DeepSeek 接口地址
- `COPILOT_PROVIDER_API_KEY`：你的 DeepSeek Key
- `COPILOT_MODEL=deepseek-reasoner`：思考模式
- `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000`：上下文 128K
- `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096`：输出最大 4K
- deepseek-reasoner 目前对应的应该就是 deepseek-v3.2 的 think-mode
- deepseek-chat 目前前对应的就是 deepseek-v3.2 的 non-thinking mode

> 如果 Copilot 提示 `Model ... is not in the built-in catalog`，通常不是错误，只是 Copilot 不认识这个模型名，不能自动推断 token 上限；手动配置即可。

---

## 第 3 步：创建 Qwen 配置文件

### Windows（PowerShell）

```powershell
@'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
COPILOT_PROVIDER_API_KEY=你的QwenKey
COPILOT_MODEL=qwen3.6-plus
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536
'@ | Set-Content -Encoding UTF8 "$HOME\.copilot\qwen.env"
```

### Mac（zsh / bash）

```bash
cat > ~/.copilot/qwen.env <<'EOF'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
COPILOT_PROVIDER_API_KEY=你的QwenKey
COPILOT_MODEL=qwen3.6-plus
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536
EOF
```

### Linux（bash / zsh）

```bash
cat > ~/.copilot/qwen.env <<'EOF'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
COPILOT_PROVIDER_API_KEY=你的QwenKey
COPILOT_MODEL=qwen3.6-plus
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536
EOF
```

### 说明

- `COPILOT_PROVIDER_BASE_URL`：DashScope 的 OpenAI-compatible 地址
- `COPILOT_MODEL=qwen3.6-plus`：按你的实际模型 ID 填
- `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000`：上下文 1,000,000
- `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536`：输出 65,536

> 如果你的平台模型 ID 不是这个名字，请以平台文档为准。

---

## 第 4 步：创建 DeepSeek 启动脚本

### Windows（PowerShell）

```powershell
@'
Get-Content "$HOME\.copilot\deepseek.env" | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}
copilot
'@ | Set-Content -Encoding UTF8 "$HOME\bin\copilot-deepseek.ps1"
```

> 如果你更想简单一点，也可以直接在 PowerShell 里手动 `export` 环境变量后运行 `copilot`，但脚本更适合长期使用。

### Mac（zsh / bash）已验证

```bash
cat > ~/bin/copilot-deepseek <<'EOF'
#!/bin/zsh
set -a
source ~/.copilot/deepseek.env
set +a
exec copilot
EOF
chmod +x ~/bin/copilot-deepseek
```

### Linux（bash / zsh）

```bash
cat > ~/bin/copilot-deepseek <<'EOF'
#!/bin/bash
set -a
source ~/.copilot/deepseek.env
set +a
exec copilot
EOF
chmod +x ~/bin/copilot-deepseek
```

---

## 第 5 步：创建 Qwen 启动脚本

### Windows（PowerShell）

```powershell
@'
Get-Content "$HOME\.copilot\qwen.env" | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}
copilot
'@ | Set-Content -Encoding UTF8 "$HOME\bin\copilot-qwen.ps1"
```

### Mac（zsh / bash）

```bash
cat > ~/bin/copilot-qwen <<'EOF'
#!/bin/zsh
set -a
source ~/.copilot/qwen.env
set +a
exec copilot
EOF
chmod +x ~/bin/copilot-qwen
```

### Linux（bash / zsh）

```bash
cat > ~/bin/copilot-qwen <<'EOF'
#!/bin/bash
set -a
source ~/.copilot/qwen.env
set +a
exec copilot
EOF
chmod +x ~/bin/copilot-qwen
```

---

## 第 6 步：把脚本目录加入 PATH

### Windows（PowerShell）

```powershell
$old = [Environment]::GetEnvironmentVariable("Path", "User")
if ($old -notlike "*$HOME\bin*") {
  [Environment]::SetEnvironmentVariable("Path", "$old;$HOME\bin", "User")
}
$env:Path = "$HOME\bin;$env:Path"
```

### Mac（zsh）

```bash
grep -q 'export PATH="$HOME/bin:$PATH"' ~/.zshrc || echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Linux（bash / zsh）

```bash
grep -q 'export PATH="$HOME/bin:$PATH"' ~/.bashrc || echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

> 如果你在 Linux 上用的是 zsh，把 `.bashrc` 改成 `.zshrc`。

---

## 第 7 步：运行 Copilot

### Windows（PowerShell）

使用 DeepSeek：

```powershell
& "$HOME\bin\copilot-deepseek.ps1"
& "$HOME\bin\copilot-qwen.ps1"
```

### Mac（zsh / bash）已验证

```bash
copilot-deepseek
copilot-qwen
```

### Linux（bash / zsh）

```bash
copilot-deepseek
copilot-qwen
```

---

## 第 8 步：常见问题处理

### 8.1 想更改上下文或输出长度

只需要修改对应的两个值：

- `COPILOT_PROVIDER_MAX_PROMPT_TOKENS`
- `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS`

例如：

- DeepSeek：`128000 / 4096`
- Qwen：`1000000 / 65536`

---

## 第 9 步：最终建议

1. 不要把 API Key 写进脚本
2. `.env` 只保存环境变量
3. 两套模型用两个独立脚本
4. 修改 `.env` 后重开终端再测试
5. 如果 Key 可能泄露，尽快重新生成

---

## 结论

这套方案的核心就是：

- 用 `.env` 保存两套配置
- 用两个启动脚本分别加载
- 用 `PATH` 让脚本可直接执行
- 用两个终端切换或同时运行

这样就能在 Windows、Mac、Linux 上都用同样的思路把 DeepSeek 和 Qwen 配好。

---

## 可选扩展：本地 token / 额度监控原型

仓库里现在额外提供了一个**独立原型**：`usage-monitor-web/`

这个原型的目标是：

- 不改现有 `copilot-deepseek` / `copilot-qwen` 的使用方式
- 不接管真实请求转发
- 先单独轮询 provider 的 usage / billing / quota 接口
- 在本地网页里展示 token、累计消耗、额度余额等信息
- Qwen 侧优先走百炼控制台页面抓取；登录态不足时可在本地配置里补 Cookie 或改接内部数据源

### 适合什么场景

如果你已经完成了 DeepSeek / Qwen 的接入，现在想继续验证：

- 平台是否提供可用的 usage / billing API
- 能否先做出一个不会影响现有部署流程的监控工具

那么可以先试这个原型。

### 启动方式

```powershell
Set-Location .\usage-monitor-web
npm start
```

默认访问：

```text
http://127.0.0.1:4173
```

### 配置方式

保留你现有的：

- `~/.copilot/deepseek.env`
- `~/.copilot/qwen.env`

然后复制示例配置：

```powershell
Copy-Item .\config\providers.example.json .\config\providers.local.json
```

再按 provider 文档填写：

- `usageApi.url`
- `balanceApi.url`
- `parser.*Path`

> 说明：`providers.local.json` 已加入 `.gitignore`，适合保留本地私有接口配置，不会影响仓库当前已有的 API 配置教程。
