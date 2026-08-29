#!/usr/bin/env bash
# Start the harness, the ops MCP server, and the UI inside WSL, then block.
#
# The trailing `wait` is load-bearing. WSL reaps a distro's background processes
# when the `wsl` invocation that launched them exits, so `nohup … &` followed by
# a script that returns leaves nothing running. Blocking here keeps the launching
# session — and therefore the children — alive.
#
# Why the harness runs under WSL at all: TrueForge v0.1.4 cannot start on
# Windows, because it calls `import()` on a raw `C:\…` path without
# `pathToFileURL()` (ERR_UNSUPPORTED_ESM_URL_SCHEME). Running under WSL also
# enables its LocalSandboxProvider, which is Linux/macOS only — so no Daytona
# account is needed.
#
# Bindings:
#   harness  127.0.0.1:8790  its default; reached only from inside WSL
#   ops MCP  127.0.0.1:8940  loopback, per docs/architecture.md § Trust model
#   UI       0.0.0.0:3000    the one exception — the browser is on the Windows
#                            host, and WSL2 forwards localhost only for services
#                            bound to 0.0.0.0. WSL2 is NAT'd, so this reaches the
#                            Windows host and the WSL virtual network, not the
#                            LAN. Mutations remain gated by SENTINEL_UI_TOKEN.
#
# Run detached from Windows:
#   wsl -d Ubuntu -- bash "$HOME/sentinel-agent/scripts/wsl-up.sh"
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

listening() { ss -ltn 2>/dev/null | grep -q ":$1 "; }

if listening 8790; then
  echo "harness   already on :8790"
else
  nohup npx -y @truefoundry/trueforge@latest > /tmp/tf-harness.log 2>&1 &
  echo "harness   starting  -> /tmp/tf-harness.log"
fi

if listening 8940; then
  echo "ops MCP   already on :8940"
else
  nohup npm run dev:mcp > /tmp/tf-mcp.log 2>&1 &
  echo "ops MCP   starting  -> /tmp/tf-mcp.log"
fi

if listening 3000; then
  echo "UI        already on :3000"
else
  nohup npm run dev --workspace @sentinel-agent/web -- --hostname 0.0.0.0 \
    > /tmp/tf-web.log 2>&1 &
  echo "UI        starting  -> /tmp/tf-web.log"
fi

# The harness has no --host flag; it always binds 127.0.0.1, so its own settings
# UI is unreachable from a browser on the Windows host. Forward it onto an
# interface WSL2 will expose. Still NAT'd, so this does not reach the LAN — but
# note the harness runs with auth disabled in standalone mode, so anything on the
# Windows host can drive it. Acceptable for local development; do not do this on
# a shared machine.
if listening 8791; then
  echo "harness↔  forwarder already on :8791"
else
  nohup socat TCP-LISTEN:8791,fork,reuseaddr TCP:127.0.0.1:8790 \
    > /tmp/tf-forward.log 2>&1 &
  echo "harness↔  forwarding 0.0.0.0:8791 -> 127.0.0.1:8790"
fi

for _ in $(seq 1 45); do
  if listening 8790 && listening 8940 && listening 3000 && listening 8791; then break; fi
  sleep 2
done

# The loop above only ever breaks early on success; exhausting it falls
# straight through with nothing having verified that. Explicitly re-check each
# port here, so a service that failed to start (crashed, hung, or is still
# installing past the timeout) is reported as failed rather than the script
# unconditionally printing READY over whatever actually happened.
echo
echo "listening:"
ss -ltn 2>/dev/null | grep -E ':(8790|8940|3000|8791) ' | sed 's/^/  /' || echo "  none"

missing=()
listening 8790 || missing+=("harness (:8790) — see /tmp/tf-harness.log")
listening 8940 || missing+=("ops MCP (:8940) — see /tmp/tf-mcp.log")
listening 3000 || missing+=("UI (:3000) — see /tmp/tf-web.log")
listening 8791 || missing+=("harness forwarder (:8791) — see /tmp/tf-forward.log")

if [ "${#missing[@]}" -gt 0 ]; then
  echo
  echo "NOT READY — the following did not start within the timeout:"
  for m in "${missing[@]}"; do echo "  - $m"; done
  exit 1
fi

echo
echo "READY — blocking to keep processes alive. Ctrl-C or kill this task to stop."

# Keep the WSL session open so the children survive.
wait
