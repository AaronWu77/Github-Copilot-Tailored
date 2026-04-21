# Copilot Instructions

## Build, test, and lint commands

The repository root still does not define a single global build, test, or lint workflow. There is no root package manifest, Makefile, CI workflow, or automated test suite, so there is also no root-level single-test command.

The only runnable artifacts checked into the repository are the two provider launcher examples:

- `zsh ./copilot-deepseek.sh`
- `zsh ./copilot-qwen.sh`

Those scripts are thin wrappers that load a provider-specific env file from the user's home directory and then `exec copilot`. The README's main supported workflow is to install equivalent launcher scripts into `$HOME/bin` or `~/bin` rather than running the repo copy directly.

There is also an isolated prototype app under `usage-monitor-web/`:

- `Set-Location .\usage-monitor-web; npm start`
- `Set-Location .\usage-monitor-web; npm run dev`
- `Set-Location .\usage-monitor-web; node --check .\src\config.js`
- `Set-Location .\usage-monitor-web; node --check .\src\collector.js`
- `Set-Location .\usage-monitor-web; node --check .\src\server.js`

This subproject currently has no automated test suite, so there is no single-test command there yet.

## High-level architecture

The README is the primary source of truth for this project. Most of the actual behavior and supported setup lives in `README.md`, not in application code.

The repository models a three-layer setup:

1. Provider-specific env files outside the repo (`$HOME\.copilot\deepseek.env`, `$HOME\.copilot\qwen.env` on Windows; `~/.copilot/*.env` on Unix-like systems)
2. Provider-specific launcher scripts (`copilot-deepseek`, `copilot-qwen`)
3. The `copilot` CLI process started after those environment variables are loaded

The checked-in shell scripts are reference implementations of layer 2 for Unix-like shells. Windows support is documented in `README.md` through PowerShell snippets that generate `copilot-deepseek.ps1` and `copilot-qwen.ps1` in the user's `$HOME\bin` directory.

The new `usage-monitor-web/` directory is intentionally isolated from that flow. It is a local monitoring prototype that reads the existing provider env files but does not modify launcher behavior or proxy requests.

## Key conventions

- Keep each provider fully isolated by name across env files, launcher filenames, and commands. `deepseek` and `qwen` are treated as separate configurations, not flags inside one shared script.
- Do not store API keys or user-specific provider settings in the repository. Secrets belong only in the user-local `~/.copilot/*.env` files described in the README.
- Launcher scripts should stay minimal: export variables from one provider-specific env file, then immediately `exec copilot`. Do not add provider logic, prompts, or fallback behavior to these wrappers.
- Use the exact `COPILOT_PROVIDER_*` and `COPILOT_MODEL` variable names shown in the README. The documentation assumes OpenAI-compatible provider configuration via environment variables.
- Keep the checked-in launcher examples synchronized with the commands documented in `README.md`. In this repository, doc changes and script changes are tightly coupled.
- `README.md` is written in Chinese and contains the validated platform-specific setup steps. When updating setup guidance, preserve the platform split already used there: Windows PowerShell, Mac zsh/bash, and Linux bash/zsh.
- Treat `usage-monitor-web/` as an optional companion tool. It should stay decoupled from the core provider-switching setup and must not require changes to `copilot-deepseek.sh`, `copilot-qwen.sh`, or the existing `~/.copilot/*.env` workflow.
