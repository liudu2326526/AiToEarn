#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/project/aitoearn-backend"
WEB_DIR="$PROJECT_ROOT/project/aitoearn-web"
LOG_DIR="${AITOEARN_LOG_DIR:-$PROJECT_ROOT/logs/local}"
PRIVATE_ENV_FILE="${AITOEARN_PRIVATE_ENV_FILE:-$HOME/.aitoearn/local.env}"

SERVER_SESSION="aitoearn-server"
AI_SESSION="aitoearn-ai"
PROXY_SESSION="aitoearn-proxy"
WEB_SESSION="aitoearn-web"

SKIP_BUILD=0
if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=1
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

is_port_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_port_free() {
  local port="$1"
  local label="$2"

  for _ in $(seq 1 20); do
    if ! is_port_listening "$port"; then
      return 0
    fi
    sleep 0.5
  done

  echo "Port $port is still in use after stopping managed sessions ($label):" >&2
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
  exit 1
}

wait_for_port_ready() {
  local port="$1"
  local label="$2"

  for _ in $(seq 1 60); do
    if is_port_listening "$port"; then
      echo "$label is listening on port $port"
      return 0
    fi
    sleep 1
  done

  echo "$label did not start on port $port. Check logs in $LOG_DIR." >&2
  exit 1
}

kill_session_if_exists() {
  local session="$1"
  tmux kill-session -t "$session" 2>/dev/null || true
}

warn_if_dependency_missing() {
  local port="$1"
  local label="$2"

  if ! is_port_listening "$port"; then
    echo "Warning: $label does not appear to be listening on port $port."
  fi
}

require_command tmux
require_command pnpm
require_command node
require_command lsof

mkdir -p "$LOG_DIR"

if [[ -f "$PRIVATE_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PRIVATE_ENV_FILE"
  set +a
  echo "Loaded private env from $PRIVATE_ENV_FILE"
else
  echo "Private env file not found at $PRIVATE_ENV_FILE; continuing with current shell environment."
fi

echo "Stopping existing AitoBee managed tmux sessions..."
kill_session_if_exists "$WEB_SESSION"
kill_session_if_exists "$PROXY_SESSION"
kill_session_if_exists "$AI_SESSION"
kill_session_if_exists "$SERVER_SESSION"

wait_for_port_free 6061 "web"
wait_for_port_free 7001 "local proxy"
wait_for_port_free 3010 "ai"
wait_for_port_free 3002 "server"

warn_if_dependency_missing 27017 "MongoDB"
warn_if_dependency_missing 6379 "Redis"
warn_if_dependency_missing 9000 "MinIO"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Building backend apps..."
  (
    cd "$BACKEND_DIR"
    pnpm nx run aitoearn-server:build
    pnpm nx run aitoearn-ai:build
  )
else
  echo "Skipping backend build because --skip-build was provided."
fi

if [[ ! -f "$BACKEND_DIR/dist/apps/aitoearn-server/src/main.js" ]]; then
  echo "Missing server build output. Run without --skip-build first." >&2
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/dist/apps/aitoearn-ai/src/main.js" ]]; then
  echo "Missing AI build output. Run without --skip-build first." >&2
  exit 1
fi

echo "Starting aitoearn-server..."
tmux new-session -d -s "$SERVER_SESSION" -c "$BACKEND_DIR" \
  "set -a; [[ -f \"$PRIVATE_ENV_FILE\" ]] && source \"$PRIVATE_ENV_FILE\"; set +a; node dist/apps/aitoearn-server/src/main.js -c apps/aitoearn-server/config/local.config.js 2>&1 | tee \"$LOG_DIR/server.log\""

echo "Starting aitoearn-ai..."
tmux new-session -d -s "$AI_SESSION" -c "$BACKEND_DIR" \
  "set -a; [[ -f \"$PRIVATE_ENV_FILE\" ]] && source \"$PRIVATE_ENV_FILE\"; set +a; node dist/apps/aitoearn-ai/src/main.js -c apps/aitoearn-ai/config/local.config.js 2>&1 | tee \"$LOG_DIR/ai.log\""

echo "Starting local API proxy..."
tmux new-session -d -s "$PROXY_SESSION" -c "$PROJECT_ROOT" \
  "set -a; [[ -f \"$PRIVATE_ENV_FILE\" ]] && source \"$PRIVATE_ENV_FILE\"; set +a; node scripts/local-api-proxy.cjs 2>&1 | tee \"$LOG_DIR/proxy.log\""

echo "Starting frontend..."
tmux new-session -d -s "$WEB_SESSION" -c "$WEB_DIR" \
  "set -a; [[ -f \"$PRIVATE_ENV_FILE\" ]] && source \"$PRIVATE_ENV_FILE\"; set +a; NEXT_PUBLIC_API_URL=http://127.0.0.1:7001/api pnpm dev 2>&1 | tee \"$LOG_DIR/web.log\""

wait_for_port_ready 3002 "aitoearn-server"
wait_for_port_ready 3010 "aitoearn-ai"
wait_for_port_ready 7001 "local API proxy"
wait_for_port_ready 6061 "frontend"

echo ""
echo "AitoBee local services are running:"
echo "- Frontend: http://127.0.0.1:6061/zh-CN"
echo "- API proxy: http://127.0.0.1:7001/api"
echo "- Server: http://127.0.0.1:3002"
echo "- AI: http://127.0.0.1:3010"
echo "- XHS Bridge: ws://127.0.0.1:9333"
echo ""
echo "Logs: $LOG_DIR"
echo "Use ./scripts/local-stop.sh to stop, or ./scripts/local-restart.sh to restart."
