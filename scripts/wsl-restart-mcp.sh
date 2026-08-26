#!/usr/bin/env bash
# Restart the ops MCP server, which re-seeds the in-memory estate.
#
# There is no HTTP reset endpoint yet (a known limitation — see
# docs/demo-script.md's pre-recording checklist), so the only way to get back
# to the seeded "degraded, dpl-4c21 live" state after someone has approved a
# rollback is to kill and restart the process that holds the estate singleton.
set -uo pipefail

PID=$(ss -ltnp 2>/dev/null | grep ':8940 ' | grep -oP 'pid=\K[0-9]+' | head -1)
if [ -n "${PID:-}" ]; then
  echo "killing mcp server (pid $PID)"
  kill "$PID"
  sleep 2
else
  echo "no mcp server currently listening on :8940"
fi

cd "$HOME/sentinel-agent"
nohup npm run dev:mcp > /tmp/tf-mcp.log 2>&1 &

for _ in $(seq 1 15); do
  ss -ltn 2>/dev/null | grep -q ':8940 ' && break
  sleep 1
done

if ss -ltn 2>/dev/null | grep -q ':8940 '; then
  echo "fresh estate up on :8940"
else
  echo "FAILED to come back up — check /tmp/tf-mcp.log"
  exit 1
fi

# Load-bearing, same reasoning as every other long-running script here: WSL
# reaps a distro's background processes when the launching `wsl` invocation
# exits. Without this, the freshly restarted MCP server dies the instant this
# script returns — which is exactly what happened the first time this script
# ran without it.
wait
