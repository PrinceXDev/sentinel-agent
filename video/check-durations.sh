#!/usr/bin/env bash
set -uo pipefail
DIR="/mnt/d/Training/Agent Harness/video/audio"
for f in "$DIR"/*.wav; do
  dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f" 2>&1)
  echo "$(basename "$f"): ${dur}s"
done
