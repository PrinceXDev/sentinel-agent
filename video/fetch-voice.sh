#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$HOME/piper-voices"
cd "$HOME/piper-voices"

BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high"
curl -fsSL -o en_US-ryan-high.onnx "$BASE/en_US-ryan-high.onnx"
curl -fsSL -o en_US-ryan-high.onnx.json "$BASE/en_US-ryan-high.onnx.json"

ls -la
