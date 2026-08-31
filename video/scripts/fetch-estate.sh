#!/usr/bin/env bash
set -u
OUT="/mnt/d/Home Workspace/sentinel-agent/video/src"
for p in audit findings state; do
  curl -s -m 10 "http://127.0.0.1:8940/estate/$p" -o "$OUT/estate-$p.json"
  echo "$p -> $(wc -c < "$OUT/estate-$p.json") bytes"
done
