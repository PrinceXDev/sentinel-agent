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
#   wsl -d Ubuntu -- bash "$(wslpath -a ./scripts/wsl-watch.sh)"
set -uo pipefail

# Derived from this script's own location, not hardcoded — the tree has already
# moved once (D:\Training\Agent Harness -> D:\Home Workspace\sentinel-agent),
# and the earlier hardcoded path here silently watched a directory that no
# longer exists rather than erroring. Same fix as wsl-sync.sh and wsl-setup.sh.
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLL_SECONDS=2

# A cheap fingerprint of everything that matters: path + mtime for every
# tracked-shape file, hashed. Must exclude exactly what wsl-sync.sh excludes —
# not "the same names under apps/*", which is what this used to prune. rsync's
# `--exclude node_modules` matches that basename at *any* depth, so
# `packages/*/node_modules` (a real workspace per package.json) was previously
# unpruned here: every file under it got scanned and hashed on every poll,
# purely to detect a directory syncing was already going to ignore.
#
# `-name` rather than `-path` is what gives this the same at-any-depth
# semantics rsync's basename exclude has — matching by name, not by a path
# anchored under a specific parent.
fingerprint() {
  find "$SRC" \
    \( -name node_modules -o -name .git -o -name .next -o -name dist \
       -o -name '*.tsbuildinfo' \) -prune -o \
    -type f -printf '%p %T@\n' 2>/dev/null | sha256sum | cut -d' ' -f1
}

# Content hash, not mtime. `stat -c '%Y'` truncates to whole seconds, while
# `fingerprint`'s `%T@` keeps the fraction — so a second `.env` edit inside the
# same wall-clock second changed `fingerprint` (triggering a sync) but not this
# (skipping the restart), and the web process kept running on the value from
# before the edit. Hashing content sidesteps clock precision entirely: it
# changes if and only if the bytes actually did.
env_fingerprint() {
  if [ -f "$SRC/.env" ]; then sha256sum "$SRC/.env" | cut -d' ' -f1; else echo "none"; fi
}

last=""
last_env=""

echo "Watching $SRC (polling every ${POLL_SECONDS}s)"
echo "Ctrl-C or stop this task to end."
echo

while true; do
  current=$(fingerprint)
  current_env=$(env_fingerprint)

  if [ -z "$last" ]; then
    # First pass: this is the starting state, not a change — establish the
    # baseline and sync nothing. Kept as its own branch (see below) rather than
    # folded into "changed and last is set", because that used to also gate
    # whether last/last_env got assigned at all — moving that assignment into
    # the sync-succeeded branch below, to fix the failed-sync bug, would
    # otherwise leave `last` permanently empty and the whole loop permanently
    # inert.
    last="$current"
    last_env="$current_env"
  elif [ "$current" != "$last" ]; then
    echo "[$(date +%H:%M:%S)] change detected -> syncing"

    # This loop runs with `set -uo pipefail`, deliberately without `-e` — a
    # sync failure must not kill the watcher, or one bad rsync ends the whole
    # session silently. But without an explicit check, "not fatal" had drifted
    # into "not checked at all": `wsl-sync.sh` (which does use `set -e`, and
    # exits nonzero when rsync is missing or fails) had its exit status ignored
    # entirely, `last` still advanced to the new fingerprint, and the loop
    # printed "done" over a WSL copy that was never actually updated. With no
    # further Windows-side edit, `current` never differs from that stale `last`
    # again, so the watcher goes quiet and stays wrong indefinitely.
    #
    # `last` is only advanced on success now, so the next poll still sees
    # `current != last` and retries — the same behaviour an operator gets by
    # noticing the failure and touching a file to force a re-check, just
    # automatic.
    if bash "$SRC/scripts/wsl-sync.sh"; then
      if [ "$current_env" != "$last_env" ]; then
        echo "[$(date +%H:%M:%S)] .env changed -> restarting web process"
        # wsl-restart-web.sh ends in its own `wait` to stay alive (same reason
        # every long-running script here does) — backgrounding it is what keeps
        # this loop from blocking on that instead of continuing to poll.
        bash "$SRC/scripts/wsl-restart-web.sh" &
      fi
      last="$current"
      last_env="$current_env"
      echo "[$(date +%H:%M:%S)] done"
    else
      echo "[$(date +%H:%M:%S)] sync FAILED — will retry next poll, WSL copy is stale until then"
    fi
    echo
  fi

  sleep "$POLL_SECONDS"
done
