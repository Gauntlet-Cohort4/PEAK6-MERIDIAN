#!/usr/bin/env bash
# ===========================================================================
# Meridian — Full Devnet Deploy Script
#
# Builds the Solana program, deploys to devnet, initializes config,
# registers all 7 tickers, and optionally runs the full lifecycle test.
#
# Usage:
#   ./scripts/deploy.sh              # Deploy to devnet
#   ./scripts/deploy.sh --test       # Deploy + run full lifecycle test
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

set -euo pipefail

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
RUN_TEST=false

for arg in "$@"; do
  case "$arg" in
    --test)  RUN_TEST=true ;;
    --help|-h)
      echo "Usage: ./scripts/deploy.sh [--test]"
      echo "  --test   Run full lifecycle test after deployment"
      exit 0
      ;;
    *)
      error "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
ADMIN_KEYPAIR_PATH="${ADMIN_KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

info "=== Meridian Devnet Deploy ==="
info "RPC:        $SOLANA_RPC_URL"
info "Admin:      $ADMIN_KEYPAIR_PATH"
info "Run test:   $RUN_TEST"
echo ""

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

for cmd in solana anchor cargo node npm; do
  if ! command -v "$cmd" &> /dev/null; then
    error "$cmd is not installed or not in PATH"
    exit 1
  fi
done

if [ ! -f "$ADMIN_KEYPAIR_PATH" ]; then
  error "Admin keypair not found at $ADMIN_KEYPAIR_PATH"
  echo "  Generate one with: solana-keygen new --outfile $ADMIN_KEYPAIR_PATH"
  exit 1
fi

ADMIN_PUBKEY=$(solana-keygen pubkey "$ADMIN_KEYPAIR_PATH")
info "Admin pubkey: $ADMIN_PUBKEY"

# Check balance
BALANCE=$(solana balance "$ADMIN_PUBKEY" --url "$SOLANA_RPC_URL" 2>/dev/null | grep -oP '[\d.]+' || echo "0")
info "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l 2>/dev/null || echo "1") )); then
  warn "Balance may be low. Requesting airdrop..."
  solana airdrop 2 "$ADMIN_PUBKEY" --url "$SOLANA_RPC_URL" || warn "Airdrop failed (may be rate-limited)"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 1: Build the program
# ---------------------------------------------------------------------------
info "Step 1/4: Building Solana program..."
anchor build 2>&1 | tail -3

if [ ! -f "target/deploy/meridian.so" ]; then
  error "Build failed — target/deploy/meridian.so not found"
  exit 1
fi

info "Build complete ($(wc -c < target/deploy/meridian.so) bytes)"
echo ""

# ---------------------------------------------------------------------------
# Step 2: Deploy to devnet
# ---------------------------------------------------------------------------
info "Step 2/4: Deploying to devnet..."

PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR_PATH:-target/deploy/meridian-keypair.json}"

if [ -f "$PROGRAM_KEYPAIR" ]; then
  PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
  info "Using existing program keypair: $PROGRAM_ID"
  solana program deploy target/deploy/meridian.so \
    --program-id "$PROGRAM_KEYPAIR" \
    --url "$SOLANA_RPC_URL" \
    --keypair "$ADMIN_KEYPAIR_PATH"
else
  info "No program keypair found, deploying as new program"
  solana program deploy target/deploy/meridian.so \
    --url "$SOLANA_RPC_URL" \
    --keypair "$ADMIN_KEYPAIR_PATH"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 3: Install npm dependencies (if needed)
# ---------------------------------------------------------------------------
if [ ! -d "node_modules" ]; then
  info "Installing npm dependencies..."
  npm install
fi

# ---------------------------------------------------------------------------
# Step 3/4: Initialize config + register tickers
# ---------------------------------------------------------------------------
info "Step 3/4: Initializing config and registering tickers..."

SOLANA_RPC_URL="$SOLANA_RPC_URL" \
ADMIN_KEYPAIR_PATH="$ADMIN_KEYPAIR_PATH" \
  npx tsx scripts/setup-devnet.ts

echo ""

# ---------------------------------------------------------------------------
# Step 4/4: Upload IDL
# ---------------------------------------------------------------------------
info "Step 4/4: Uploading IDL..."

PROGRAM_ID=$(solana-keygen pubkey "${PROGRAM_KEYPAIR:-target/deploy/meridian-keypair.json}" 2>/dev/null || echo "unknown")
anchor idl init --filepath target/idl/meridian.json "$PROGRAM_ID" \
  --provider.cluster "$SOLANA_RPC_URL" \
  --provider.wallet "$ADMIN_KEYPAIR_PATH" 2>/dev/null || \
anchor idl upgrade --filepath target/idl/meridian.json "$PROGRAM_ID" \
  --provider.cluster "$SOLANA_RPC_URL" \
  --provider.wallet "$ADMIN_KEYPAIR_PATH" 2>/dev/null || \
  warn "IDL upload skipped (may already be up to date)"

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
info "=== Deployment Complete ==="
info "Program ID:  $PROGRAM_ID"
info "Admin:       $ADMIN_PUBKEY"
info "Network:     devnet"
FINAL_BALANCE=$(solana balance "$ADMIN_PUBKEY" --url "$SOLANA_RPC_URL" 2>/dev/null || echo "unknown")
info "Balance:     $FINAL_BALANCE"

# ---------------------------------------------------------------------------
# Optional: Run lifecycle test
# ---------------------------------------------------------------------------
if [ "$RUN_TEST" = true ]; then
  echo ""
  info "=== Running Full Lifecycle Test ==="
  npx tsx scripts/test-full-pipeline.ts
fi

echo ""
info "Done. To run the frontend:"
info "  cd app && npm run dev"
