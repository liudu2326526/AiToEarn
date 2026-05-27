#!/usr/bin/env bash
set -euo pipefail

SESSIONS=(
  "aitoearn-web"
  "aitoearn-proxy"
  "aitoearn-ai"
  "aitoearn-server"
)

for session in "${SESSIONS[@]}"; do
  if tmux has-session -t "$session" 2>/dev/null; then
    tmux kill-session -t "$session"
    echo "Stopped $session"
  else
    echo "$session is not running"
  fi
done

echo ""
echo "Remaining listeners on common local AitoBee ports:"
for port in 6061 7001 3010 3002 9333; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is still occupied:"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN
  else
    echo "Port $port is free"
  fi
done
