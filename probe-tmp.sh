#!/usr/bin/env bash
cd "$HOME/sentinel-agent" || exit 1
. "$HOME/sentinel-agent/scripts/wsl-node.sh" >/dev/null 2>&1
export SENTINEL_MODEL="openrouter/claude-sonnet-4-5"
export OPS_LAB_TOKEN="labverify$(date +%s)"

listening(){ ss -ltn 2>/dev/null | grep -q ":$1 "; }
kill_port(){ p=$(ss -ltnp 2>/dev/null|grep ":$1 "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ]&&kill -9 "$p" 2>/dev/null; sleep 1; }

listening 8790 || { nohup npx -y @truefoundry/trueforge@latest > /tmp/tf-harness.log 2>&1 & }
kill_port 8940
OPS_LAB_MODE=1 nohup npx tsx apps/mcp-server/src/index.ts > /tmp/tf-mcp.log 2>&1 &
for _ in $(seq 1 40); do listening 8940 && listening 8790 && break; sleep 2; done
echo "listening: $(ss -ltn 2>/dev/null | grep -cE ':(8790|8940) ') of 2"
echo

node scripts/prove-gate.mjs
echo "PROVE_EXIT=$?"
cp reports/gate-conformance.json "/mnt/d/Home Workspace/sentinel-agent/reports/" 2>/dev/null
