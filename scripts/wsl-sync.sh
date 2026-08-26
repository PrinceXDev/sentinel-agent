#!/usr/bin/env bash
# Mirror the current Windows source tree into the WSL working copy.
#
# Full re-mirror rather than syncing individual paths one at a time: passing a
# shell variable through a one-shot `wsl -- bash -c '...'` invocation from Git
# Bash on Windows has repeatedly arrived empty on the WSL side (a Git
# Bash/MSYS -> wsl.exe argument-quoting issue, not a WSL one) — every fix in
# this session that needed a variable to survive that boundary went through a
# script file instead, and this is the same fix applied to syncing itself.
#
# rsync only, deliberately no tar fallback. The tar fallback this script used
# to have never deleted anything from the destination — a file removed on the
# Windows side kept running live in WSL indefinitely, silently drifting from
# what the source actually says. `rsync --delete` is what makes this an actual
# mirror rather than a one-way copy that only ever grows; a fallback that
# can't do that isn't a fallback, it's a second, worse sync path. Ubuntu ships
# rsync by default, so failing loudly when it is missing is preferable to
# quietly reintroducing the drift this script exists to prevent.
set -euo pipefail

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required (this script no longer falls back to tar — see the" >&2
  echo "comment above for why) — install it: sudo apt-get install -y rsync" >&2
  exit 1
fi

SRC="/mnt/d/Training/Agent Harness"
DEST="$HOME/sentinel-agent"

# --delete respects --exclude by default (no --delete-excluded here), so
# node_modules/.next/dist/*.tsbuildinfo — which exist only in WSL and have no
# Windows-side counterpart — are left alone rather than deleted.
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude dist --exclude '*.tsbuildinfo' \
  "$SRC/" "$DEST/"

echo "synced $SRC -> $DEST (with deletions)"
