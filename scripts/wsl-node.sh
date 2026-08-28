#!/usr/bin/env bash
# Put the WSL-native Node on PATH. Sourced by the other wsl-*.sh scripts.
#
# ## Why this is not optional
#
# These scripts are invoked as `wsl -d Ubuntu -- bash scripts/wsl-up.sh`, which
# is neither a login nor an interactive shell, so `~/.bashrc` and `~/.profile`
# never run and nvm is never loaded. What *is* on PATH in that shell is the
# Windows PATH, injected by WSL interop — including `/mnt/c/Program Files/nodejs`.
#
# So a bare `npm install` in an unsourced script resolves to **Windows npm**
# running under Linux bash. It half-works, which is the problem: it installs
# packages with Windows-resolved native binaries into a Linux tree, and the
# failure surfaces much later as an opaque module-load error.
#
# Two things have to be true, and neither is by default:
#
#   1. Node must be the Linux build under nvm, not the interop Windows one.
#   2. It must be >= 22.14 — TrueForge's floor. The nvm default here was
#      v20.19.3, which is silently too old: the harness fails at runtime rather
#      than at install, and the error does not mention the version.
#
# `nvm install 22 && nvm alias default 22` was run once to satisfy (2). This
# script enforces both on every invocation and fails loudly if it cannot.

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm not found at $NVM_DIR — install it, then: nvm install 22" >&2
  return 1 2>/dev/null || exit 1
fi

# nvm.sh trips both `set -u` (unset vars on some code paths) and `set -e`
# (harmless non-zero returns from its internal helpers). The callers use
# `set -euo pipefail`, so sourcing it unguarded aborts the calling script before
# it prints a single line — which is exactly how this failed the first time.
# Relax both for the duration of the source, then restore whatever was set.
_had_u=0; _had_e=0
case "$-" in *u*) _had_u=1; set +u ;; esac
case "$-" in *e*) _had_e=1; set +e ;; esac
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
# `--delete-prefix` because this machine's ~/.npmrc carries a `prefix` /
# `globalconfig` setting (left by a system-wide npm install). nvm refuses to
# activate while one is set and writes a multi-line warning to stderr — which,
# on a plain `nvm use`, both fails to switch versions *and* makes every caller
# look like it errored. Deleting the prefix for this shell only is the fix nvm
# itself recommends; it does not touch the file.
nvm use --delete-prefix default --silent >/dev/null 2>&1 ||
  nvm use --delete-prefix 22 --silent >/dev/null 2>&1 || true
[ "$_had_u" = 1 ] && set -u
[ "$_had_e" = 1 ] && set -e
unset _had_u _had_e

if ! command -v node >/dev/null 2>&1; then
  echo "node still not on PATH after loading nvm — run: nvm install 22" >&2
  return 1 2>/dev/null || exit 1
fi

# Reject the interop Windows binaries explicitly. Without this check the scripts
# appear to work right up until a native module fails to load.
case "$(command -v node)" in
  /mnt/*)
    echo "node resolves to the Windows binary via interop: $(command -v node)" >&2
    echo "nvm did not take effect. Run: nvm install 22 && nvm alias default 22" >&2
    return 1 2>/dev/null || exit 1
    ;;
esac

_node_major="$(node --version | sed 's/^v\([0-9]*\).*/\1/')"
_node_minor="$(node --version | sed 's/^v[0-9]*\.\([0-9]*\).*/\1/')"
if [ "$_node_major" -lt 22 ] || { [ "$_node_major" -eq 22 ] && [ "$_node_minor" -lt 14 ]; }; then
  echo "node $(node --version) is below TrueForge's floor of 22.14" >&2
  echo "Run: nvm install 22 && nvm alias default 22" >&2
  return 1 2>/dev/null || exit 1
fi
unset _node_major _node_minor

echo "node $(node --version) at $(command -v node)"
