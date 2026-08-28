#!/usr/bin/env bash
# Restart only the web process so it re-reads .env, then block.
#
# Next.js loads .env once at process boot; editing the file afterward does
# nothing until the process restarts. And a background job started inside a
# one-shot `wsl -- bash -c '...'` invocation dies the moment that invocation
# returns — `disown` alone does not survive it, only blocking with `wait` does,
# same as scripts/wsl-up.sh.
set -uo pipefail
cd "$HOME/sentinel-agent"
# Put the WSL-native Node >= 22.14 on PATH. Without this the script runs with
# the Windows Node injected by WSL interop. See scripts/wsl-node.sh.
#
# The `|| exit 1` is load-bearing. This script uses `set -uo pipefail` without
# `-e` on purpose, so a sourced helper returning non-zero does NOT stop it — and
# wsl-node.sh returns 1 for exactly the environments it exists to reject (nvm
# absent, an interop Windows binary, a Node below 22.14). Without the explicit
# check it would print its refusal and the script would carry on and launch the
# services with the runtime it just rejected.
# shellcheck source=scripts/wsl-node.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wsl-node.sh" || exit 1

PID=$(ss -ltnp 2>/dev/null | grep ':3000 ' | grep -oP 'pid=\K[0-9]+' | head -1)
if [ -n "${PID:-}" ]; then
  echo "killing stale web process (pid $PID)"
  kill -9 "$PID" 2>/dev/null
  sleep 1
fi

nohup npm run dev --workspace @sentinel-agent/web -- --hostname 0.0.0.0 \
  > /tmp/tf-web.log 2>&1 &

for _ in $(seq 1 30); do
  ss -ltn 2>/dev/null | grep -q ':3000 ' && break
  sleep 1
done

echo "listening:"
ss -ltn 2>/dev/null | grep ':3000 ' || echo "  NOT LISTENING"
echo
echo "READY — blocking to keep the process alive."
wait
