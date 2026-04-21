# 本地同时配置 DeepSeek 与 Qwen 的 Copilot CLI 教程

本文记录了如何在 macOS 本地为 GitHub Copilot CLI 同时配置两套模型：DeepSeek 和 Qwen，并通过两个独立启动脚本长期切换和使用。

> 安全提示：如果你曾把 API Key 明文贴到终端或对话里，请先去对应平台重新生成新的 Key，再把旧 Key 作废。

---

## 1. 目标

我们希望实现：

1. 一套 DeepSeek 配置
2. 一套 Qwen 配置
3. 两个独立启动脚本
4. 可长期使用
5. 可随时切换模型
6. 可同时打开两个终端各跑一套

---

## 2. 目录结构

建议最终结构如下：

```text
~/.copilot/
  deepseek.env
  qwen.env

~/bin/
  copilot-deepseek
  copilot-qwen
```

---

## 3. 配置 DeepSeek

### 3.1 `~/.copilot/deepseek.env`

编辑该文件：

```bash
mkdir -p ~/.copilot
cat > ~/.copilot/deepseek.env <<'EOF'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekKey
COPILOT_MODEL=deepseek-reasoner
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096
EOF
```

### 3.2 说明

- `COPILOT_PROVIDER_TYPE=openai`：因为 DeepSeek 按 OpenAI-compatible 接口使用
- `COPILOT_PROVIDER_BASE_URL`：DeepSeek 接口地址
- `COPILOT_PROVIDER_API_KEY`：你的 DeepSeek Key
- `COPILOT_MODEL=deepseek-reasoner`：思考模式
- `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000`：上下文长度 128K
- `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096`：输出最大 4K

> 如果你看到 “Model is not in the built-in catalog” 提示，这通常不是错误，只是 Copilot 不认识这个模型名，不能自动推断上下文上限；手动配置 token 参数即可。

---

## 4. 配置 Qwen

### 4.1 `~/.copilot/qwen.env`

编辑该文件：

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

### 4.2 说明

- `COPILOT_PROVIDER_BASE_URL`：DashScope 的 OpenAI-compatible 地址
- `COPILOT_MODEL=qwen3.6-plus`：按你的实际模型 ID 填
- `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000`：上下文长度 1,000,000
- `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536`：输出最大 65,536

> 如果你的平台返回的模型 ID 不是这个写法，请以平台文档为准；Copilot 只负责把它当作后端模型名使用。

---

## 5. 创建启动脚本

### 5.1 DeepSeek 启动脚本

```bash
mkdir -p ~/bin
cat > ~/bin/copilot-deepseek <<'EOF'
#!/bin/zsh
set -a
source ~/.copilot/deepseek.env
set +a
exec copilot
EOF
```

### 5.2 Qwen 启动脚本

```bash
cat > ~/bin/copilot-qwen <<'EOF'
#!/bin/zsh
set -a
source ~/.copilot/qwen.env
set +a
exec copilot
EOF
```

### 5.3 赋予执行权限

```bash
chmod +x ~/bin/copilot-deepseek ~/bin/copilot-qwen
```

> 注意：必须先创建脚本，再 `chmod`，否则会出现 “No such file or directory”。

---

## 6. 让脚本可直接执行

如果 `~/bin` 还没有加入 PATH，执行：

```bash
grep -q 'export PATH="$HOME/bin:$PATH"' ~/.zshrc || echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

这样以后你就可以直接运行：

```bash
copilot-deepseek
copilot-qwen
```

---

## 7. 完整一键命令

如果你想一次性完成全部创建，可以直接执行下面整段：

```bash
mkdir -p ~/.copilot ~/bin

cat > ~/.copilot/deepseek.env <<'EOF'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekKey
COPILOT_MODEL=deepseek-reasoner
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096
EOF

cat > ~/.copilot/qwen.env <<'EOF'
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
COPILOT_PROVIDER_API_KEY=你的QwenKey
COPILOT_MODEL=qwen3.6-plus
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536
EOF

cat > ~/bin/copilot-deepseek <<'EOF'
#!/bin/zsh
set -a
source ~/.copilot/deepseek.env
set +a
exec copilot
EOF

cat > ~/bin/copilot-qwen <<'EOF'
#!/bin/zsh
set -a
source ~/.copilot/qwen.env
set +a
exec copilot
EOF

chmod +x ~/bin/copilot-deepseek ~/bin/copilot-qwen
grep -q 'export PATH="$HOME/bin:$PATH"' ~/.zshrc || echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

## 8. 如何运行

### 8.1 使用 DeepSeek

```bash
copilot-deepseek
```

### 8.2 使用 Qwen

```bash
copilot-qwen
```

### 8.3 同时使用

打开两个终端窗口：

- 一个运行 `copilot-deepseek`
- 另一个运行 `copilot-qwen`

---

## 9. 常见提示与处理

### 9.1 “Model is not in the built-in catalog”

这不是致命错误，只表示 Copilot 不认识这个模型名，因此会使用默认的 prompt/output token 参数。

处理方式：

1. 保持当前模型名继续使用
2. 手动加上 `COPILOT_PROVIDER_MAX_PROMPT_TOKENS`
3. 手动加上 `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS`

### 9.2 改了 `.env` 但还是显示旧模型

先检查是否还有别的地方写着旧值：

```bash
grep -R "deepseek-reasoner\|qwen3.6-plus" ~/.copilot ~/.zshrc ~/bin 2>/dev/null
```

然后：

- 确认当前终端是重新打开的
- 确认脚本读取的是正确的 `.env`
- 确认你没有在别处手动 `export COPILOT_MODEL=...`

### 9.3 `chmod: No such file or directory`

说明脚本还没创建。先 `cat > ~/bin/copilot-deepseek` 和 `cat > ~/bin/copilot-qwen`，再 `chmod +x`。

---

## 10. 推荐的最终配置

### DeepSeek

```bash
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/v1
COPILOT_PROVIDER_API_KEY=你的DeepSeekKey
COPILOT_MODEL=deepseek-reasoner
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=128000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=4096
```

### Qwen

```bash
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
COPILOT_PROVIDER_API_KEY=你的QwenKey
COPILOT_MODEL=qwen3.6-plus
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=65536
```

---

## 11. 最后建议

1. 不要把 Key 写死在脚本里
2. `.env` 文件只保存环境变量
3. 两套模型用两个独立脚本
4. 重新打开终端后再测试
5. 如果平台 Key 已泄露，请立刻重新生成

---

## 12. 结论

这套方案的核心思路是：

- 用 `.env` 保存两套模型配置
- 用两个 shell 脚本分别加载配置并启动 `copilot`
- 通过不同脚本切换 DeepSeek / Qwen
- 通过两个终端同时运行两个会话

这样就能长期、稳定地在本地同时管理两套 Copilot 模型。
