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
# (:8940) themselves stay on loopback, unreachable directly.
#
# The proxy at :3000 is a different matter. `/tf/*` forwards to the harness with
# a server-held bearer token attached, and until this was reviewed, only
# mutating methods required the operator token — a GET needed nothing at all.
# Tunnelling the whole origin made every read on that route public: anyone with
# the URL could pull harness session and turn data with no credential. The
# proxy (apps/web/src/app/tf/[...path]/route.ts) now requires the operator
# token for anything that does not arrive with the expected local `Host`
# header, which a tunnelled request never does — so this script's own tunnel is
# what makes that check load-bearing rather than redundant.
#
# Approving or denying anything still needs the operator token either way, and
# that token lives only in the browser that entered it — sharing this URL does
# not hand out the ability to act, only, as of the fix above, the ability to
# read anything at all without it.
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

# Poll for the URL rather than sleeping once and grepping once — tunnel
# provisioning is a network round-trip to Cloudflare with no fixed latency, and
# a one-shot check after a fixed delay either finds it or gives up permanently,
# even though cloudflared keeps running and the URL always appears eventually.
URL=""
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/tf-tunnel.log | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

echo
if [ -n "$URL" ]; then
  echo "==> Public URL: $URL"
else
  # Still not up after 30s — genuinely unusual, but cloudflared is still
  # running, so keep watching in the background instead of giving up on
  # something that may simply be slow.
  echo "==> Not up yet after 30s — still watching in the background. Check /tmp/tf-tunnel.log."
  (
    while true; do
      u=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/tf-tunnel.log | head -1)
      if [ -n "$u" ]; then
        echo
        echo "==> Public URL: $u"
        break
      fi
      sleep 2
    done
  ) &
fi
echo
echo "Blocking to keep the tunnel alive. Stop this task to close it."
wait
