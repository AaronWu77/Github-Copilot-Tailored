#!/bin/zsh

# Load DeepSeek-specific Copilot settings from a separate file.
# Edit ~/.copilot/deepseek.env with your actual values before using this script.
set -a
source ~/.copilot/deepseek.env
set +a

exec copilot
