#!/bin/zsh

# Load Qwen-specific Copilot settings from a separate file.
# Edit ~/.copilot/qwen.env with your actual values before using this script.
set -a
source ~/.copilot/qwen.env
set +a

exec copilot
