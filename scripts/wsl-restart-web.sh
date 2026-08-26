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
