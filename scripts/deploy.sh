#!/usr/bin/env bash
# ===========================================================================
# Meridian — Full Devnet Deploy Script
#
# Builds the Solana program, deploys to devnet, initializes config,
# registers tickers, uploads IDL, starts automation & frontend.
#
# Usage:
#   ./scripts/deploy.sh                    # Run all steps sequentially
#   ./scripts/deploy.sh --step=build       # Build the Solana program only
#   ./scripts/deploy.sh --step=deploy      # Deploy to devnet only
#   ./scripts/deploy.sh --step=init        # Initialize config + register tickers
#   ./scripts/deploy.sh --step=idl         # Upload IDL only
#   ./scripts/deploy.sh --step=automation  # Start automation service only
#   ./scripts/deploy.sh --step=frontend    # Start frontend dev server only
#   ./scripts/deploy.sh --test             # Run all steps + lifecycle test
#   ./scripts/deploy.sh --step=build --test
#
# Prerequisites:
#   - Solana CLI (solana, solana-keygen)
#   - Anchor CLI (anchor)
#   - Rust + cargo-build-sbf
#   - Node.js 18+ and npm
#   - A funded devnet keypair at ~/.config/solana/id.json
#     (or set ADMIN_KEYPAIR_PATH env var)
#
# Environment variables (all optional, sensible defaults provided):
#   SOLANA_RPC_URL          - RPC endpoint (default: https://api.devnet.solana.com)
#   ADMIN_KEYPAIR_PATH      - Path to admin keypair (default: ~/.config/solana/id.json)
#   PROGRAM_KEYPAIR_PATH    - Path to program keypair (default: target/deploy/meridian-keypair.json)
# ===========================================================================

# We handle errors per-step, so no set -e
set -uo pipefail

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
step_header() { echo -e "\n${CYAN}${BOLD}── $* ──${NC}"; }

# ---------------------------------------------------------------------------
# Step status tracking
# ---------------------------------------------------------------------------
declare -A STEP_STATUS
ALL_STEPS=(build deploy init idl automation frontend)

for s in "${ALL_STEPS[@]}"; do
  STEP_STATUS[$s]="NOT_RUN"
done

FAILED_STEPS=()

mark_done()    { STEP_STATUS[$1]="DONE"; }
mark_skipped() { STEP_STATUS[$1]="SKIPPED"; }
mark_failed()  {
  STEP_STATUS[$1]="FAILED"
  FAILED_STEPS+=("$1")
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
RUN_TEST=false
REQUESTED_STEP=""

for arg in "$@"; do
  case "$arg" in
    --test)
      RUN_TEST=true
      ;;
    --step=*)
      REQUESTED_STEP="${arg#--step=}"
      ;;
    --help|-h)
      echo "Usage: ./scripts/deploy.sh [--step=STEP] [--test]"
      echo ""
      echo "Steps: build, deploy, init, idl, automation, frontend"
      echo ""
      echo "  --step=STEP  Run only the specified step"
      echo "  --test       Run full lifecycle test after deployment"
      echo "  --help       Show this help message"
      exit 0
      ;;
    *)
      error "Unknown argument: $arg"
      echo "Run with --help for usage information."
      exit 1
      ;;
  esac
done

# Validate requested step
if [ -n "$REQUESTED_STEP" ]; then
  valid=false
  for s in "${ALL_STEPS[@]}"; do
    if [ "$s" = "$REQUESTED_STEP" ]; then
      valid=true
      break
    fi
  done
  if [ "$valid" = false ]; then
    error "Unknown step: $REQUESTED_STEP"
    echo "Valid steps: ${ALL_STEPS[*]}"
    exit 1
  fi
fi

should_run_step() {
  [ -z "$REQUESTED_STEP" ] || [ "$REQUESTED_STEP" = "$1" ]
}

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
ADMIN_KEYPAIR_PATH="${ADMIN_KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR_PATH:-target/deploy/meridian-keypair.json}"
PID_DIR="$PROJECT_DIR/.pids"

cd "$PROJECT_DIR"

info "=== Meridian Devnet Deploy ==="
info "RPC:        $SOLANA_RPC_URL"
info "Admin:      $ADMIN_KEYPAIR_PATH"
info "Run test:   $RUN_TEST"
if [ -n "$REQUESTED_STEP" ]; then
  info "Step:       $REQUESTED_STEP"
else
  info "Step:       all"
fi

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
step_header "Checking dependencies"

REQUIRED_TOOLS=(solana anchor cargo node npm npx tsx)
MISSING_TOOLS=()

for cmd in "${REQUIRED_TOOLS[@]}"; do
  if command -v "$cmd" &> /dev/null; then
    info "  ✓ $cmd ($(command -v "$cmd"))"
  else
    error "  ✗ $cmd — NOT FOUND"
    MISSING_TOOLS+=("$cmd")
  fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo ""
  error "Missing required tools: ${MISSING_TOOLS[*]}"
  echo ""
  echo "Install instructions:"
  for tool in "${MISSING_TOOLS[@]}"; do
    case "$tool" in
      solana)  echo "  solana   → sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\"" ;;
      anchor)  echo "  anchor   → cargo install --git https://github.com/coral-xyz/anchor avm && avm install latest && avm use latest" ;;
      cargo)   echo "  cargo    → curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" ;;
      node)    echo "  node     → https://nodejs.org/ or: nvm install 18" ;;
      npm)     echo "  npm      → Comes with Node.js" ;;
      npx)     echo "  npx      → Comes with npm (npm install -g npm)" ;;
      tsx)     echo "  tsx      → npm install -g tsx" ;;
    esac
  done
  exit 1
fi

# Check admin keypair
if [ ! -f "$ADMIN_KEYPAIR_PATH" ]; then
  error "Admin keypair not found at $ADMIN_KEYPAIR_PATH"
  echo "  Generate one with: solana-keygen new --outfile $ADMIN_KEYPAIR_PATH"
  exit 1
fi

ADMIN_PUBKEY=$(solana-keygen pubkey "$ADMIN_KEYPAIR_PATH")
info "Admin pubkey: $ADMIN_PUBKEY"

# Check balance (non-fatal)
BALANCE=$(solana balance "$ADMIN_PUBKEY" --url "$SOLANA_RPC_URL" 2>/dev/null | grep -oP '[\d.]+' || echo "0")
info "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l 2>/dev/null || echo "1") )); then
  warn "Balance may be low. Requesting airdrop..."
  solana airdrop 2 "$ADMIN_PUBKEY" --url "$SOLANA_RPC_URL" 2>/dev/null || warn "Airdrop failed (may be rate-limited)"
fi

# Ensure PID directory exists
mkdir -p "$PID_DIR"

# Ensure root npm dependencies are installed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  info "Installing root npm dependencies..."
  npm install
fi

# ---------------------------------------------------------------------------
# Step functions
# ---------------------------------------------------------------------------

step_build() {
  step_header "Step: build — Build Solana program"

  # Idempotent check: skip if .so is newer than all source files
  if [ -f "target/deploy/meridian.so" ]; then
    local newest_source
    newest_source=$(find programs/meridian/src -type f -name '*.rs' -newer target/deploy/meridian.so 2>/dev/null | head -1)
    if [ -z "$newest_source" ]; then
      info "target/deploy/meridian.so is up to date — skipping build"
      mark_skipped build
      return 0
    fi
    info "Source files changed since last build — rebuilding"
  fi

  info "Running anchor build..."
  if anchor build 2>&1 | tail -5; then
    if [ -f "target/deploy/meridian.so" ]; then
      info "Build complete ($(wc -c < target/deploy/meridian.so) bytes)"
      mark_done build
    else
      error "Build finished but target/deploy/meridian.so not found"
      mark_failed build
    fi
  else
    error "anchor build failed"
    mark_failed build
  fi
}

step_deploy() {
  step_header "Step: deploy — Deploy to devnet"

  # Need the .so to exist
  if [ ! -f "target/deploy/meridian.so" ]; then
    error "target/deploy/meridian.so not found — run --step=build first"
    mark_failed deploy
    return 1
  fi

  local program_id=""
  if [ -f "$PROGRAM_KEYPAIR" ]; then
    program_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR" 2>/dev/null)
  fi

  # Idempotent check: see if program is already deployed
  if [ -n "$program_id" ]; then
    local account_info
    account_info=$(solana account "$program_id" --url "$SOLANA_RPC_URL" 2>/dev/null || true)
    if echo "$account_info" | grep -q "Executable: Yes"; then
      # Program exists — check if binary changed by comparing deploy slot vs build time
      # For simplicity, we deploy (upgrade) if the .so is newer than a deploy marker
      if [ -f "$PID_DIR/.last_deploy_marker" ] && [ "target/deploy/meridian.so" -ot "$PID_DIR/.last_deploy_marker" ]; then
        info "Program $program_id is already deployed and .so unchanged — skipping"
        mark_skipped deploy
        return 0
      fi
      info "Program $program_id exists — upgrading..."
    fi
  fi

  info "Deploying program to devnet..."
  if [ -f "$PROGRAM_KEYPAIR" ]; then
    info "Using program keypair: $program_id"
    if solana program deploy target/deploy/meridian.so \
        --program-id "$PROGRAM_KEYPAIR" \
        --url "$SOLANA_RPC_URL" \
        --keypair "$ADMIN_KEYPAIR_PATH"; then
      touch "$PID_DIR/.last_deploy_marker"
      mark_done deploy
    else
      error "Program deploy failed"
      mark_failed deploy
    fi
  else
    info "No program keypair found, deploying as new program"
    if solana program deploy target/deploy/meridian.so \
        --url "$SOLANA_RPC_URL" \
        --keypair "$ADMIN_KEYPAIR_PATH"; then
      touch "$PID_DIR/.last_deploy_marker"
      mark_done deploy
    else
      error "Program deploy failed"
      mark_failed deploy
    fi
  fi
}

step_init() {
  step_header "Step: init — Initialize config + register tickers"

  info "Running setup-devnet.ts (idempotent)..."
  if SOLANA_RPC_URL="$SOLANA_RPC_URL" \
     ADMIN_KEYPAIR_PATH="$ADMIN_KEYPAIR_PATH" \
     npx tsx scripts/setup-devnet.ts; then
    mark_done init
  else
    error "setup-devnet.ts failed"
    mark_failed init
  fi
}

step_idl() {
  step_header "Step: idl — Upload IDL"

  local program_id=""
  if [ -f "$PROGRAM_KEYPAIR" ]; then
    program_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR" 2>/dev/null || echo "")
  fi

  if [ -z "$program_id" ]; then
    error "Cannot determine program ID — is the program keypair present?"
    mark_failed idl
    return 1
  fi

  if [ ! -f "target/idl/meridian.json" ]; then
    error "target/idl/meridian.json not found — run --step=build first"
    mark_failed idl
    return 1
  fi

  info "Attempting IDL init for $program_id..."
  if anchor idl init --filepath target/idl/meridian.json "$program_id" \
      --provider.cluster "$SOLANA_RPC_URL" \
      --provider.wallet "$ADMIN_KEYPAIR_PATH" 2>/dev/null; then
    info "IDL initialized successfully"
    mark_done idl
  else
    info "IDL init failed (may already exist) — attempting upgrade..."
    if anchor idl upgrade --filepath target/idl/meridian.json "$program_id" \
        --provider.cluster "$SOLANA_RPC_URL" \
        --provider.wallet "$ADMIN_KEYPAIR_PATH" 2>/dev/null; then
      info "IDL upgraded successfully"
      mark_done idl
    else
      warn "IDL upload skipped — may already be current"
      mark_skipped idl
    fi
  fi
}

step_automation() {
  step_header "Step: automation — Start automation service"

  local automation_dir="$PROJECT_DIR/automation"

  if [ ! -d "$automation_dir" ]; then
    error "Automation directory not found at $automation_dir"
    mark_failed automation
    return 1
  fi

  # Check if already running
  if [ -f "$PID_DIR/automation.pid" ]; then
    local existing_pid
    existing_pid=$(cat "$PID_DIR/automation.pid")
    if kill -0 "$existing_pid" 2>/dev/null; then
      info "Automation service already running (PID $existing_pid) — skipping"
      mark_skipped automation
      return 0
    else
      info "Stale PID file found — cleaning up"
      rm -f "$PID_DIR/automation.pid"
    fi
  fi

  # Check / install dependencies
  if [ ! -d "$automation_dir/node_modules" ]; then
    info "Installing automation dependencies..."
    if ! (cd "$automation_dir" && npm install); then
      error "Failed to install automation dependencies"
      mark_failed automation
      return 1
    fi
  fi

  # Build TypeScript
  info "Building automation service..."
  if ! (cd "$automation_dir" && npm run build 2>&1 | tail -3); then
    error "Automation build failed"
    mark_failed automation
    return 1
  fi

  # Start in background
  info "Starting automation service..."
  (
    cd "$automation_dir"
    SOLANA_RPC_URL="$SOLANA_RPC_URL" \
    ADMIN_KEYPAIR_PATH="$ADMIN_KEYPAIR_PATH" \
    node dist/index.js >> "$PROJECT_DIR/logs/automation.log" 2>&1
  ) &
  local auto_pid=$!
  echo "$auto_pid" > "$PID_DIR/automation.pid"

  # Give it a moment to start (or crash)
  sleep 2

  if kill -0 "$auto_pid" 2>/dev/null; then
    info "Automation service started (PID $auto_pid)"
    info "Logs: $PROJECT_DIR/logs/automation.log"
    mark_done automation
  else
    error "Automation service exited immediately — check logs/automation.log"
    rm -f "$PID_DIR/automation.pid"
    mark_failed automation
  fi
}

step_frontend() {
  step_header "Step: frontend — Start Next.js dev server"

  local app_dir="$PROJECT_DIR/app"

  if [ ! -d "$app_dir" ]; then
    error "App directory not found at $app_dir"
    mark_failed frontend
    return 1
  fi

  # Check if port 3002 is already in use
  if ss -tlnp 2>/dev/null | grep -q ':3002 ' || \
     netstat -tlnp 2>/dev/null | grep -q ':3002 '; then
    info "Port 3002 is already in use — frontend likely running — skipping"
    mark_skipped frontend
    return 0
  fi

  # Check for existing PID file
  if [ -f "$PID_DIR/frontend.pid" ]; then
    local existing_pid
    existing_pid=$(cat "$PID_DIR/frontend.pid")
    if kill -0 "$existing_pid" 2>/dev/null; then
      info "Frontend already running (PID $existing_pid) — skipping"
      mark_skipped frontend
      return 0
    else
      info "Stale PID file found — cleaning up"
      rm -f "$PID_DIR/frontend.pid"
    fi
  fi

  # Check / install dependencies
  if [ ! -d "$app_dir/node_modules" ]; then
    info "Installing frontend dependencies..."
    if ! (cd "$app_dir" && npm install); then
      error "Failed to install frontend dependencies"
      mark_failed frontend
      return 1
    fi
  fi

  # Start in background
  info "Starting Next.js dev server on port 3002..."
  mkdir -p "$PROJECT_DIR/logs"
  (
    cd "$app_dir"
    npm run dev >> "$PROJECT_DIR/logs/frontend.log" 2>&1
  ) &
  local fe_pid=$!
  echo "$fe_pid" > "$PID_DIR/frontend.pid"

  # Give it a few seconds to start
  sleep 3

  if kill -0 "$fe_pid" 2>/dev/null; then
    info "Frontend started (PID $fe_pid)"
    info "URL:  http://localhost:3002"
    info "Logs: $PROJECT_DIR/logs/frontend.log"
    mark_done frontend
  else
    error "Frontend exited immediately — check logs/frontend.log"
    rm -f "$PID_DIR/frontend.pid"
    mark_failed frontend
  fi
}

# ---------------------------------------------------------------------------
# Ensure logs directory exists
# ---------------------------------------------------------------------------
mkdir -p "$PROJECT_DIR/logs"

# ---------------------------------------------------------------------------
# Execute steps
# ---------------------------------------------------------------------------
if should_run_step "build"; then
  step_build
fi

if should_run_step "deploy"; then
  step_deploy
fi

if should_run_step "init"; then
  step_init
fi

if should_run_step "idl"; then
  step_idl
fi

if should_run_step "automation"; then
  step_automation
fi

if should_run_step "frontend"; then
  step_frontend
fi

# ---------------------------------------------------------------------------
# Optional: Run lifecycle test
# ---------------------------------------------------------------------------
if [ "$RUN_TEST" = true ]; then
  step_header "Running Full Lifecycle Test"
  if npx tsx scripts/test-full-pipeline.ts; then
    info "Lifecycle test passed"
  else
    error "Lifecycle test failed"
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}=== Deploy Summary ===${NC}"
echo ""

# Resolve program ID for display
PROGRAM_ID=""
if [ -f "$PROGRAM_KEYPAIR" ]; then
  PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR" 2>/dev/null || echo "unknown")
fi
FINAL_BALANCE=$(solana balance "$ADMIN_PUBKEY" --url "$SOLANA_RPC_URL" 2>/dev/null || echo "unknown")

printf "  %-14s %s\n" "Program ID:" "${PROGRAM_ID:-not set}"
printf "  %-14s %s\n" "Admin:" "$ADMIN_PUBKEY"
printf "  %-14s %s\n" "Network:" "devnet"
printf "  %-14s %s\n" "Balance:" "$FINAL_BALANCE"
echo ""

# Step status table
printf "  ${BOLD}%-15s %-10s${NC}\n" "STEP" "STATUS"
printf "  %-15s %-10s\n" "───────────────" "──────────"

for s in "${ALL_STEPS[@]}"; do
  local_status="${STEP_STATUS[$s]}"
  case "$local_status" in
    DONE)    color="$GREEN" ;;
    SKIPPED) color="$YELLOW" ;;
    FAILED)  color="$RED" ;;
    *)       color="$DIM" ;;
  esac
  printf "  %-15s ${color}%-10s${NC}\n" "$s" "$local_status"
done

echo ""

# Final exit code
if [ ${#FAILED_STEPS[@]} -gt 0 ]; then
  error "Failed steps: ${FAILED_STEPS[*]}"
  exit 1
else
  info "All executed steps completed successfully."
fi
