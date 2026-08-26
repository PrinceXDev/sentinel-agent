#!/usr/bin/env bash
# Mirror the current Windows source tree into the WSL working copy, file by
# file, then report which web source files changed since the last sync (as a
# reminder to check the dev server log for a successful hot-reload).
#
# Full re-mirror rather than syncing individual paths one at a time: passing a
# shell variable through a one-shot `wsl -- bash -c '...'` invocation from Git
# Bash on Windows has repeatedly arrived empty on the WSL side (a Git
# Bash/MSYS -> wsl.exe argument-quoting issue, not a WSL one) — every fix in
# this session that needed a variable to survive that boundary went through a
# script file instead, and this is the same fix applied to syncing itself.
set -euo pipefail

SRC="/mnt/d/Training/Agent Harness"
DEST="$HOME/sentinel-agent"

rsync -a --exclude node_modules --exclude .next --exclude dist --exclude '*.tsbuildinfo' \
  "$SRC/" "$DEST/" 2>/dev/null || \
  tar -C "$SRC" --exclude=node_modules --exclude=.next --exclude=dist --exclude='*.tsbuildinfo' \
    -cf - . | tar -C "$DEST" -xf -

echo "synced $SRC -> $DEST"
