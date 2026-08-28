#!/usr/bin/env bash
# Mirror this working tree into the WSL filesystem and install dependencies.
#
# TrueForge v0.1.4 cannot start on Windows: it calls `import()` on a raw `C:\…`
# path without `pathToFileURL()`, so Node rejects it with
# ERR_UNSUPPORTED_ESM_URL_SCHEME. Running the harness under WSL avoids that, and
# has a second benefit — TrueForge's LocalSandboxProvider is Linux/macOS only, so
# under WSL the sandbox works with no Daytona account at all.
#
# Everything runs inside WSL so the harness reaches the ops MCP server over
# loopback, which keeps the security posture from docs/architecture.md intact.
# `node_modules` is not copied: native binaries differ between Windows and Linux,
# so it is reinstalled here.
#
# Usage, from the repository root on Windows:
#   wsl -d Ubuntu -- bash "$(wslpath -a ./scripts/wsl-setup.sh)"
set -euo pipefail

# Derived from this script's own location rather than hardcoded. The tree has
# already moved once (D:\Training\Agent Harness -> D:\Home Workspace\sentinel-agent),
# and a hardcoded SRC fails by mirroring a stale or absent directory rather than
# by erroring, which is the worst way for a sync script to be wrong.
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Put the WSL-native Node >= 22.14 on PATH. Without this the script runs with
# the Windows Node injected by WSL interop. See scripts/wsl-node.sh.
# shellcheck source=scripts/wsl-node.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wsl-node.sh"
DEST="$HOME/sentinel-agent"

echo "==> mirroring $SRC -> $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

tar -C "$SRC" \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=dist \
  --exclude='*.tsbuildinfo' \
  -cf - . | tar -C "$DEST" -xf -

cd "$DEST"

echo "==> git state"
git branch --show-current || true
git log --oneline -1 || true

echo "==> files"
[ -f .env ] && echo "  .env present" || echo "  .env MISSING"
[ -f scripts/doctor.mjs ] && echo "  doctor present" || echo "  doctor MISSING"

echo "==> node"
node --version
npm --version

echo "==> installing dependencies (Linux binaries)"
npm install --no-audit --no-fund

echo "==> done: $DEST"
