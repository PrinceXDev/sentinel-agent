#!/usr/bin/env bash
# Expose the local UI (:3000) to the internet via a Cloudflare Quick Tunnel.
#
# No account, no card, no signup: a Quick Tunnel is an anonymous, free feature
# of `cloudflared` that opens an *outbound* connection from this machine to
# Cloudflare, which then routes a random https://<name>.trycloudflare.com URL
# to it. Nothing needs to be exposed inbound — no port forwarding, no firewall
# rule — because the connection is initiated from this side.
#
# Only :3000 (the Next.js app) is tunnelled. The harness (:8790) and MCP server
# (:8940) stay on loopback exactly as documented in docs/architecture.md
# § Trust model — the tunnel does not change that boundary at all, it just
# gives the one already-public-facing surface a real HTTPS URL.
#
# The URL is only live while this process runs, and changes every time it
# restarts (Quick Tunnels don't have a stable hostname — that requires a named
# tunnel against a real Cloudflare account + domain, a later step if wanted).
#
# Same reasoning as wsl-up.sh for the trailing `wait`: WSL reaps a distro's
# background processes when the launching `wsl` invocation exits, so this has
# to block to keep the tunnel alive.
set -uo pipefail

echo "Starting Cloudflare Quick Tunnel -> http://localhost:3000"
echo "Watch for a line like: https://something-random-words.trycloudflare.com"
echo

cloudflared tunnel --url http://localhost:3000 2>&1 | tee /tmp/tf-tunnel.log &

# Give it a few seconds, then pull the URL out of its own log rather than
# making you scroll for it.
sleep 6
URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/tf-tunnel.log | head -1)
echo
if [ -n "$URL" ]; then
  echo "==> Public URL: $URL"
else
  echo "==> URL not found yet — check /tmp/tf-tunnel.log"
fi
echo
echo "Blocking to keep the tunnel alive. Stop this task to close it."
wait
