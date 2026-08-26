#!/usr/bin/env bash
# Auto-sync Windows source changes into WSL, then hot-reload or restart.
#
# Polls rather than watches via inotify. Inotify events are well documented as
# unreliable across the DrvFs boundary (/mnt/d) specifically when the file is
# edited from the Windows side — which is every edit in this setup, since the
# source of truth lives on the Windows filesystem. A polling loop is the one
# that actually fires reliably here; an inotify-based watcher would look
# correct in testing and then silently miss changes in exactly the situation
# this script exists for.
#
# What happens on a detected change:
#   - Always: re-sync via wsl-sync.sh (rsync --delete, so deletions propagate
#     too, not just edits/additions)
#   - Source files (.ts/.tsx/.css/etc.): nothing further needed — Next's own
#     dev-mode file watcher picks up the freshly-synced files and hot-reloads
#   - .env specifically: Next only reads environment variables at process
#     boot, so hot-reload alone would not see a changed value. Detected
#     separately by its own mtime and triggers wsl-restart-web.sh.
#
# Run detached from Windows, same as wsl-up.sh / wsl-tunnel.sh:
#   wsl -d Ubuntu-24.04 -- bash "/mnt/d/Training/Agent Harness/scripts/wsl-watch.sh"
set -uo pipefail

SRC="/mnt/d/Training/Agent Harness"
POLL_SECONDS=2

# A cheap fingerprint of everything that matters: path + mtime for every
# tracked-shape file, hashed. Prunes exactly what wsl-sync.sh already excludes,
# so the fingerprint never changes because of a build artifact syncing wouldn't
# have touched anyway.
fingerprint() {
  find "$SRC" \
    \( -path "$SRC/node_modules" -o -path "$SRC/.git" \
       -o -path "$SRC/apps/*/node_modules" -o -path "$SRC/apps/*/.next" \
       -o -path "$SRC/apps/*/dist" \) -prune -o \
    -type f -printf '%p %T@\n' 2>/dev/null | sha256sum | cut -d' ' -f1
}

env_fingerprint() {
  if [ -f "$SRC/.env" ]; then stat -c '%Y' "$SRC/.env" 2>/dev/null; else echo "none"; fi
}

last=""
last_env=""

echo "Watching $SRC (polling every ${POLL_SECONDS}s)"
echo "Ctrl-C or stop this task to end."
echo

while true; do
  current=$(fingerprint)
  current_env=$(env_fingerprint)

  # `-n "$last"` skips acting on the very first fingerprint taken — that is
  # the starting state, not a change.
  if [ -n "$last" ] && [ "$current" != "$last" ]; then
    echo "[$(date +%H:%M:%S)] change detected -> syncing"
    bash "$SRC/scripts/wsl-sync.sh"

    if [ "$current_env" != "$last_env" ]; then
      echo "[$(date +%H:%M:%S)] .env changed -> restarting web process"
      # wsl-restart-web.sh ends in its own `wait` to stay alive (same reason
      # every long-running script here does) — backgrounding it is what keeps
      # this loop from blocking on that instead of continuing to poll.
      bash "$SRC/scripts/wsl-restart-web.sh" &
    fi

    echo "[$(date +%H:%M:%S)] done"
    echo
  fi

  last="$current"
  last_env="$current_env"
  sleep "$POLL_SECONDS"
done
