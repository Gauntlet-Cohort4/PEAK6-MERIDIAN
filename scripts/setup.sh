#!/usr/bin/env bash
# ===========================================================================
# Meridian — From-Scratch Setup Script
#
# Bootstraps a fresh development environment: checks dependencies, generates
# keypairs and program IDs, creates .env, installs npm packages, builds the
# Solana program, deploys to devnet, and initializes on-chain state.
#
# Designed for Git Bash on Windows and native bash on macOS/Linux.
# Idempotent — safe to run multiple times.
#
# Usage:
#   ./scripts/setup.sh                  # Run all steps
#   ./scripts/setup.sh --deps-only      # Check/install dependencies only
#   ./scripts/setup.sh --env-only       # Generate .env only
#   ./scripts/setup.sh --keys-only      # Generate keypairs + program IDs only
#   ./scripts/setup.sh --install-only   # npm install only
#   ./scripts/setup.sh --build-only     # Build Solana program only
#   ./scripts/setup.sh --deploy-only    # Deploy to devnet only
#   ./scripts/setup.sh --init-only      # Initialize on-chain state only
#   ./scripts/setup.sh --frontend-only  # Start frontend dev server only
#   ./scripts/setup.sh --all            # Explicit full run (same as no flags)
#   ./scripts/setup.sh --help           # Show usage
#
# Environment overrides:
#   SOLANA_RPC_URL        - RPC endpoint (default: https://api.devnet.solana.com)
#   ADMIN_KEYPAIR_PATH    - Admin keypair path (default: ~/.config/solana/id.json)
#   SOLANA_NETWORK        - Network name (default: devnet)
#   SKIP_AIRDROP=1        - Skip SOL airdrop
# ===========================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Color helpers (safe for Git Bash / MinTTY)
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[FAIL]${NC}  $*"; }
header() { echo -e "\n${CYAN}${BOLD}=== $* ===${NC}"; }

# ---------------------------------------------------------------------------
# Resolve project root (works from any CWD)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
RUN_DEPS=false
RUN_ENV=false
RUN_KEYS=false
RUN_INSTALL=false
RUN_BUILD=false
RUN_DEPLOY=false
RUN_INIT=false
RUN_FRONTEND=false
RUN_ALL=false
SHOW_HELP=false
SPECIFIC_STEP=false

for arg in "$@"; do
  case "$arg" in
    --deps-only)      RUN_DEPS=true;     SPECIFIC_STEP=true ;;
    --env-only)       RUN_ENV=true;      SPECIFIC_STEP=true ;;
    --keys-only)      RUN_KEYS=true;     SPECIFIC_STEP=true ;;
    --install-only)   RUN_INSTALL=true;  SPECIFIC_STEP=true ;;
    --build-only)     RUN_BUILD=true;    SPECIFIC_STEP=true ;;
    --deploy-only)    RUN_DEPLOY=true;   SPECIFIC_STEP=true ;;
    --init-only)      RUN_INIT=true;     SPECIFIC_STEP=true ;;
    --frontend-only)  RUN_FRONTEND=true; SPECIFIC_STEP=true ;;
    --all)            RUN_ALL=true ;;
    --help|-h)        SHOW_HELP=true ;;
    *)
      error "Unknown argument: $arg"
      echo "Run with --help for usage."
      exit 1
      ;;
  esac
done

if [ "$SHOW_HELP" = true ]; then
  echo "Usage: ./scripts/setup.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --deps-only       Check required tools are installed"
  echo "  --env-only        Generate .env from .env.example"
  echo "  --keys-only       Generate Solana keypairs and program IDs"
  echo "  --install-only    Run npm install across all workspaces"
  echo "  --build-only      Build the Solana program (anchor build)"
  echo "  --deploy-only     Deploy program to devnet"
  echo "  --init-only       Initialize on-chain config + register tickers"
  echo "  --frontend-only   Start the Next.js dev server"
  echo "  --all             Run all steps (default if no flags given)"
  echo "  --help            Show this help message"
  echo ""
  echo "Multiple flags can be combined: --deps-only --env-only --install-only"
  echo ""
  echo "Environment overrides:"
  echo "  SOLANA_RPC_URL       RPC endpoint"
  echo "  ADMIN_KEYPAIR_PATH   Path to admin keypair JSON"
  echo "  SOLANA_NETWORK       Network name (devnet/mainnet-beta)"
  echo "  SKIP_AIRDROP=1       Skip SOL airdrop step"
  exit 0
fi

# If no specific step requested, run all
if [ "$SPECIFIC_STEP" = false ] || [ "$RUN_ALL" = true ]; then
  RUN_DEPS=true
  RUN_ENV=true
  RUN_KEYS=true
  RUN_INSTALL=true
  RUN_BUILD=true
  RUN_DEPLOY=true
  RUN_INIT=true
fi

# ---------------------------------------------------------------------------
# Configuration defaults
# ---------------------------------------------------------------------------
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
SOLANA_NETWORK="${SOLANA_NETWORK:-devnet}"
ADMIN_KEYPAIR_PATH="${ADMIN_KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
PROGRAM_KEYPAIR_PATH="${PROGRAM_KEYPAIR_PATH:-$PROJECT_DIR/target/deploy/meridian-keypair.json}"
SKIP_AIRDROP="${SKIP_AIRDROP:-0}"

# Track failures
FAILURES=()

fail_step() {
  FAILURES+=("$1")
  error "$1 failed"
}

# ===========================================================================
# STEP 1: Dependency Checks
# ===========================================================================
step_deps() {
  header "Step 1/7: Checking Dependencies"

  local missing=()
  local warnings=()

  # --- Required tools ---
  declare -A TOOL_INSTALL_HINTS
  TOOL_INSTALL_HINTS=(
    [node]="https://nodejs.org/ (v20+) or: nvm install 20"
    [npm]="Included with Node.js"
    [solana]="sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\""
    [solana-keygen]="Included with Solana CLI"
    [anchor]="cargo install --git https://github.com/coral-xyz/anchor avm && avm install latest && avm use latest"
    [cargo]="curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    [rustc]="curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  )

  for tool in node npm solana solana-keygen anchor cargo rustc; do
    if command -v "$tool" &>/dev/null; then
      local version_str=""
      case "$tool" in
        node)           version_str="$(node --version 2>/dev/null)" ;;
        npm)            version_str="$(npm --version 2>/dev/null)" ;;
        solana)         version_str="$(solana --version 2>/dev/null | head -1)" ;;
        solana-keygen)  version_str="present" ;;
        anchor)         version_str="$(anchor --version 2>/dev/null)" ;;
        cargo)          version_str="$(cargo --version 2>/dev/null)" ;;
        rustc)          version_str="$(rustc --version 2>/dev/null)" ;;
      esac
      info "$tool  ($version_str)"
    else
      error "$tool  -- NOT FOUND"
      missing+=("$tool")
    fi
  done

  # --- Optional but recommended ---
  for tool in tsx git; do
    if command -v "$tool" &>/dev/null; then
      info "$tool  (optional, found)"
    else
      warn "$tool  (optional, not found)"
      warnings+=("$tool")
    fi
  done

  # --- Node version check (require >=20) ---
  if command -v node &>/dev/null; then
    local node_major
    node_major=$(node -e "console.log(process.versions.node.split('.')[0])")
    if [ "$node_major" -lt 20 ] 2>/dev/null; then
      error "Node.js v${node_major} detected, but v20+ is required"
      missing+=("node>=20")
    fi
  fi

  # --- Report missing ---
  if [ ${#missing[@]} -gt 0 ]; then
    echo ""
    error "Missing required tools: ${missing[*]}"
    echo ""
    echo "Install instructions:"
    for tool in "${missing[@]}"; do
      local hint="${TOOL_INSTALL_HINTS[$tool]:-See project README}"
      echo "  $tool  ->  $hint"
    done
    echo ""
    error "Please install the missing tools and re-run this script."
    fail_step "deps"
    return 1
  fi

  if [ ${#warnings[@]} -gt 0 ]; then
    warn "Optional tools not found: ${warnings[*]}"
    echo "  tsx -> npm install -g tsx  (used for running TypeScript scripts)"
    echo "  git -> https://git-scm.com/"
  fi

  info "All required dependencies are present."
  return 0
}

# ===========================================================================
# STEP 2: Generate / Detect Keypairs and Program IDs
# ===========================================================================
step_keys() {
  header "Step 2/7: Keypairs & Program IDs"

  # --- Admin keypair ---
  if [ -f "$ADMIN_KEYPAIR_PATH" ]; then
    local admin_pubkey
    admin_pubkey=$(solana-keygen pubkey "$ADMIN_KEYPAIR_PATH" 2>/dev/null)
    info "Admin keypair exists: $admin_pubkey"
    info "  Path: $ADMIN_KEYPAIR_PATH"
  else
    warn "Admin keypair not found at $ADMIN_KEYPAIR_PATH"
    echo "  Generating a new keypair..."

    # Ensure parent directory exists
    mkdir -p "$(dirname "$ADMIN_KEYPAIR_PATH")"

    if solana-keygen new --outfile "$ADMIN_KEYPAIR_PATH" --no-bip39-passphrase --force 2>/dev/null; then
      local admin_pubkey
      admin_pubkey=$(solana-keygen pubkey "$ADMIN_KEYPAIR_PATH" 2>/dev/null)
      info "Generated admin keypair: $admin_pubkey"
      info "  Path: $ADMIN_KEYPAIR_PATH"
    else
      error "Failed to generate admin keypair"
      fail_step "keys (admin keypair)"
      return 1
    fi
  fi

  # Configure Solana CLI to use our settings
  solana config set --url "$SOLANA_RPC_URL" --keypair "$ADMIN_KEYPAIR_PATH" &>/dev/null || true

  # --- Program keypair ---
  local program_keypair_dir
  program_keypair_dir="$(dirname "$PROGRAM_KEYPAIR_PATH")"
  mkdir -p "$program_keypair_dir"

  if [ -f "$PROGRAM_KEYPAIR_PATH" ]; then
    local program_id
    program_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR_PATH" 2>/dev/null)
    info "Program keypair exists: $program_id"
    info "  Path: $PROGRAM_KEYPAIR_PATH"
  else
    warn "Program keypair not found at $PROGRAM_KEYPAIR_PATH"
    echo "  Generating a new program keypair..."

    if solana-keygen new --outfile "$PROGRAM_KEYPAIR_PATH" --no-bip39-passphrase --force 2>/dev/null; then
      local program_id
      program_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR_PATH" 2>/dev/null)
      info "Generated program keypair: $program_id"
      info "  Path: $PROGRAM_KEYPAIR_PATH"

      # Update Anchor.toml with the new program ID
      update_anchor_toml "$program_id"
      # Update the program's lib.rs declare_id!
      update_program_id_in_source "$program_id"
    else
      error "Failed to generate program keypair"
      fail_step "keys (program keypair)"
      return 1
    fi
  fi

  # --- Fund admin wallet (devnet only) ---
  if [ "$SOLANA_NETWORK" = "devnet" ] && [ "$SKIP_AIRDROP" != "1" ]; then
    local admin_pubkey
    admin_pubkey=$(solana-keygen pubkey "$ADMIN_KEYPAIR_PATH" 2>/dev/null)
    local balance
    balance=$(solana balance "$admin_pubkey" --url "$SOLANA_RPC_URL" 2>/dev/null | grep -oE '[0-9]+\.?[0-9]*' | head -1 || echo "0")

    info "Admin balance: ${balance} SOL"

    # Try airdrop if balance is low
    local needs_airdrop=false
    if command -v bc &>/dev/null; then
      if (( $(echo "$balance < 1" | bc -l 2>/dev/null) )); then
        needs_airdrop=true
      fi
    else
      # No bc available (common on Windows Git Bash), do simple integer check
      local int_balance="${balance%%.*}"
      if [ "${int_balance:-0}" -lt 1 ] 2>/dev/null; then
        needs_airdrop=true
      fi
    fi

    if [ "$needs_airdrop" = true ]; then
      warn "Balance is low. Requesting airdrop..."
      if solana airdrop 2 "$admin_pubkey" --url "$SOLANA_RPC_URL" 2>/dev/null; then
        info "Airdrop successful"
      else
        warn "Airdrop failed (may be rate-limited). You can fund manually:"
        echo "  solana airdrop 2 $admin_pubkey --url $SOLANA_RPC_URL"
      fi
    fi
  fi

  return 0
}

# ---------------------------------------------------------------------------
# Helper: Update Anchor.toml with program ID
# ---------------------------------------------------------------------------
update_anchor_toml() {
  local program_id="$1"
  local anchor_toml="$PROJECT_DIR/Anchor.toml"

  if [ ! -f "$anchor_toml" ]; then
    warn "Anchor.toml not found, skipping update"
    return
  fi

  # Replace the program ID line under [programs.devnet]
  if grep -q 'meridian = "' "$anchor_toml"; then
    # Use portable sed (works on both GNU and BSD sed)
    local tmp_file
    tmp_file=$(mktemp)
    sed "s/meridian = \"[A-Za-z0-9]*\"/meridian = \"$program_id\"/" "$anchor_toml" > "$tmp_file"
    mv "$tmp_file" "$anchor_toml"
    info "Updated Anchor.toml program ID -> $program_id"
  fi
}

# ---------------------------------------------------------------------------
# Helper: Update declare_id! in program source
# ---------------------------------------------------------------------------
update_program_id_in_source() {
  local program_id="$1"
  local lib_rs="$PROJECT_DIR/programs/meridian/src/lib.rs"

  if [ ! -f "$lib_rs" ]; then
    warn "programs/meridian/src/lib.rs not found, skipping source update"
    return
  fi

  if grep -q 'declare_id!' "$lib_rs"; then
    local tmp_file
    tmp_file=$(mktemp)
    sed "s/declare_id!(\"[A-Za-z0-9]*\")/declare_id!(\"$program_id\")/" "$lib_rs" > "$tmp_file"
    mv "$tmp_file" "$lib_rs"
    info "Updated lib.rs declare_id! -> $program_id"
  fi
}

# ===========================================================================
# STEP 3: Generate .env
# ===========================================================================
step_env() {
  header "Step 3/7: Environment File (.env)"

  local env_file="$PROJECT_DIR/.env"
  local env_example="$PROJECT_DIR/.env.example"

  if [ -f "$env_file" ]; then
    info ".env already exists — preserving existing file"
    info "  To regenerate, delete .env and re-run: ./scripts/setup.sh --env-only"
    return 0
  fi

  if [ ! -f "$env_example" ]; then
    error ".env.example not found at project root"
    fail_step "env"
    return 1
  fi

  info "Creating .env from .env.example..."

  # Read the program ID if available
  local program_id="DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE"
  if [ -f "$PROGRAM_KEYPAIR_PATH" ]; then
    program_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR_PATH" 2>/dev/null || echo "$program_id")
  fi

  # Determine USDC mint for the network
  local usdc_mint
  case "$SOLANA_NETWORK" in
    mainnet|mainnet-beta) usdc_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" ;;
    *)                    usdc_mint="DZSY3GVoKSzMMh1vePZdgHsMavPyhB9dEGDjVtqHSYro" ;;
  esac

  # Copy .env.example and substitute generated values
  cp "$env_example" "$env_file"

  # Apply substitutions (portable sed approach using temp files)
  local tmp_file
  tmp_file=$(mktemp)

  sed \
    -e "s|^SOLANA_RPC_URL=.*|SOLANA_RPC_URL=$SOLANA_RPC_URL|" \
    -e "s|^ADMIN_KEYPAIR_PATH=.*|ADMIN_KEYPAIR_PATH=$ADMIN_KEYPAIR_PATH|" \
    -e "s|^SOLANA_NETWORK=.*|SOLANA_NETWORK=$SOLANA_NETWORK|" \
    -e "s|^PROGRAM_ID=.*|PROGRAM_ID=$program_id|" \
    -e "s|^MERIDIAN_PROGRAM_ID=.*|MERIDIAN_PROGRAM_ID=$program_id|" \
    -e "s|^NEXT_PUBLIC_SOLANA_RPC_URL=.*|NEXT_PUBLIC_SOLANA_RPC_URL=$SOLANA_RPC_URL|" \
    -e "s|^NEXT_PUBLIC_MERIDIAN_PROGRAM_ID=.*|NEXT_PUBLIC_MERIDIAN_PROGRAM_ID=$program_id|" \
    -e "s|^NEXT_PUBLIC_USDC_MINT=.*|NEXT_PUBLIC_USDC_MINT=$usdc_mint|" \
    "$env_file" > "$tmp_file"

  mv "$tmp_file" "$env_file"

  info ".env created with generated values:"
  info "  PROGRAM_ID=$program_id"
  info "  USDC_MINT=$usdc_mint"
  info "  NETWORK=$SOLANA_NETWORK"
  info "  RPC=$SOLANA_RPC_URL"

  # Also create app/.env.local for Next.js if it doesn't exist
  local app_env="$PROJECT_DIR/app/.env.local"
  if [ ! -f "$app_env" ] && [ -d "$PROJECT_DIR/app" ]; then
    info "Creating app/.env.local for Next.js..."
    cat > "$app_env" <<ENVEOF
# Auto-generated by setup.sh — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
NEXT_PUBLIC_SOLANA_RPC_URL=$SOLANA_RPC_URL
NEXT_PUBLIC_MERIDIAN_PROGRAM_ID=$program_id
NEXT_PUBLIC_USDC_MINT=$usdc_mint
NEXT_PUBLIC_PYTH_HERMES_URL=https://hermes.pyth.network
NEXT_PUBLIC_DEMO_MODE=false
ENVEOF
    info "Created app/.env.local"
  fi

  return 0
}

# ===========================================================================
# STEP 4: Install Dependencies
# ===========================================================================
step_install() {
  header "Step 4/7: Installing Dependencies"

  # Root npm install (workspaces handle shared/automation/app)
  if [ -d "$PROJECT_DIR/node_modules" ] && [ -f "$PROJECT_DIR/node_modules/.package-lock.json" ]; then
    info "node_modules exists — running npm install to ensure up-to-date..."
  else
    info "Installing npm dependencies (root + workspaces)..."
  fi

  if npm install 2>&1 | tail -5; then
    info "npm install complete"
  else
    error "npm install failed"
    fail_step "install"
    return 1
  fi

  # Ensure tsx is available (needed for TypeScript scripts)
  if ! command -v tsx &>/dev/null; then
    if [ -f "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
      info "tsx available via node_modules/.bin/tsx"
    else
      info "Installing tsx globally for TypeScript script execution..."
      npm install -g tsx 2>/dev/null || warn "Failed to install tsx globally; scripts may need npx tsx"
    fi
  fi

  return 0
}

# ===========================================================================
# STEP 5: Build
# ===========================================================================
step_build() {
  header "Step 5/7: Building Solana Program"

  # Check if build is needed
  if [ -f "target/deploy/meridian.so" ]; then
    local needs_rebuild=false

    # Check if any source files are newer than the .so
    local newer_sources
    newer_sources=$(find programs/meridian/src -type f -name '*.rs' -newer target/deploy/meridian.so 2>/dev/null | head -1)

    if [ -z "$newer_sources" ]; then
      # Also check if Anchor.toml changed (program ID might have changed)
      if [ "Anchor.toml" -nt "target/deploy/meridian.so" ]; then
        needs_rebuild=true
        info "Anchor.toml changed since last build — rebuilding"
      else
        info "target/deploy/meridian.so is up to date — skipping build"
        return 0
      fi
    else
      needs_rebuild=true
      info "Source files changed — rebuilding"
    fi
  fi

  info "Running anchor build (this may take a few minutes)..."
  if anchor build 2>&1; then
    if [ -f "target/deploy/meridian.so" ]; then
      local so_size
      so_size=$(wc -c < target/deploy/meridian.so 2>/dev/null || echo "unknown")
      info "Build complete ($so_size bytes)"

      # Sync program keypair: anchor build generates its own keypair
      # Make sure our Anchor.toml program ID matches the keypair
      if [ -f "$PROGRAM_KEYPAIR_PATH" ]; then
        local anchor_program_id
        anchor_program_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR_PATH" 2>/dev/null)

        # Verify Anchor.toml matches
        if grep -q "meridian = \"$anchor_program_id\"" Anchor.toml; then
          info "Program ID matches Anchor.toml: $anchor_program_id"
        else
          warn "Program keypair ($anchor_program_id) does not match Anchor.toml"
          echo "  Updating Anchor.toml and rebuilding..."
          update_anchor_toml "$anchor_program_id"
          anchor build 2>&1 | tail -3
        fi
      fi
    else
      error "Build completed but meridian.so not found"
      fail_step "build"
      return 1
    fi
  else
    error "anchor build failed"
    fail_step "build"
    return 1
  fi

  return 0
}

# ===========================================================================
# STEP 6: Deploy
# ===========================================================================
step_deploy() {
  header "Step 6/7: Deploying to $SOLANA_NETWORK"

  if [ ! -f "target/deploy/meridian.so" ]; then
    error "target/deploy/meridian.so not found — run --build-only first"
    fail_step "deploy"
    return 1
  fi

  local program_id=""
  if [ -f "$PROGRAM_KEYPAIR_PATH" ]; then
    program_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR_PATH" 2>/dev/null)
  fi

  # Check if already deployed and unchanged
  if [ -n "$program_id" ]; then
    local account_info
    account_info=$(solana account "$program_id" --url "$SOLANA_RPC_URL" 2>/dev/null || true)
    if echo "$account_info" | grep -q "Executable: Yes"; then
      local marker="$PROJECT_DIR/.pids/.last_deploy_marker"
      if [ -f "$marker" ] && [ "target/deploy/meridian.so" -ot "$marker" ]; then
        info "Program $program_id is already deployed and .so unchanged — skipping"
        return 0
      fi
      info "Program exists on-chain — upgrading..."
    fi
  fi

  info "Deploying program..."
  mkdir -p "$PROJECT_DIR/.pids"

  local deploy_args=(
    "program" "deploy" "target/deploy/meridian.so"
    "--url" "$SOLANA_RPC_URL"
    "--keypair" "$ADMIN_KEYPAIR_PATH"
  )

  if [ -f "$PROGRAM_KEYPAIR_PATH" ]; then
    deploy_args+=("--program-id" "$PROGRAM_KEYPAIR_PATH")
    info "Using program keypair: $program_id"
  fi

  if solana "${deploy_args[@]}" 2>&1; then
    touch "$PROJECT_DIR/.pids/.last_deploy_marker"
    local deployed_id
    deployed_id=$(solana-keygen pubkey "$PROGRAM_KEYPAIR_PATH" 2>/dev/null || echo "$program_id")
    info "Program deployed: $deployed_id"

    # Update .env if it exists with the deployed program ID
    if [ -f "$PROJECT_DIR/.env" ] && [ -n "$deployed_id" ]; then
      local tmp_file
      tmp_file=$(mktemp)
      sed \
        -e "s|^PROGRAM_ID=.*|PROGRAM_ID=$deployed_id|" \
        -e "s|^MERIDIAN_PROGRAM_ID=.*|MERIDIAN_PROGRAM_ID=$deployed_id|" \
        -e "s|^NEXT_PUBLIC_MERIDIAN_PROGRAM_ID=.*|NEXT_PUBLIC_MERIDIAN_PROGRAM_ID=$deployed_id|" \
        "$PROJECT_DIR/.env" > "$tmp_file"
      mv "$tmp_file" "$PROJECT_DIR/.env"
      info "Updated .env with deployed program ID"
    fi
  else
    error "Program deploy failed"
    echo ""
    echo "  Common fixes:"
    echo "  - Ensure you have enough SOL: solana airdrop 2 --url $SOLANA_RPC_URL"
    echo "  - Check keypair permissions: ls -la $ADMIN_KEYPAIR_PATH"
    echo "  - Try extending the program: solana program extend <PROGRAM_ID> 50000 --url $SOLANA_RPC_URL"
    fail_step "deploy"
    return 1
  fi

  return 0
}

# ===========================================================================
# STEP 7: Initialize On-Chain State
# ===========================================================================
step_init() {
  header "Step 7/7: Initializing On-Chain State"

  info "Running setup-devnet.ts (idempotent — safe to re-run)..."

  # Prefer tsx, fall back to npx tsx
  local tsx_cmd="npx tsx"
  if command -v tsx &>/dev/null; then
    tsx_cmd="tsx"
  elif [ -f "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
    tsx_cmd="$PROJECT_DIR/node_modules/.bin/tsx"
  fi

  if SOLANA_RPC_URL="$SOLANA_RPC_URL" \
     ADMIN_KEYPAIR_PATH="$ADMIN_KEYPAIR_PATH" \
     SOLANA_NETWORK="$SOLANA_NETWORK" \
     $tsx_cmd scripts/setup-devnet.ts 2>&1; then
    info "On-chain initialization complete"
  else
    error "setup-devnet.ts failed"
    echo ""
    echo "  This step initializes the config PDA and registers tickers."
    echo "  If the program is not yet deployed, run --deploy-only first."
    fail_step "init"
    return 1
  fi

  return 0
}

# ===========================================================================
# STEP: Frontend (only when explicitly requested)
# ===========================================================================
step_frontend() {
  header "Starting Frontend"

  local app_dir="$PROJECT_DIR/app"
  if [ ! -d "$app_dir" ]; then
    error "App directory not found at $app_dir"
    fail_step "frontend"
    return 1
  fi

  # Check if port 3000 or 3002 is already in use
  local port_in_use=false
  if command -v netstat &>/dev/null; then
    if netstat -ano 2>/dev/null | grep -qE ':300[02]\s'; then
      port_in_use=true
    fi
  fi

  if [ "$port_in_use" = true ]; then
    info "Frontend port appears to be in use — it may already be running"
    return 0
  fi

  info "Starting Next.js dev server..."
  cd "$app_dir"
  npm run dev
}

# ===========================================================================
# Execute requested steps
# ===========================================================================
echo -e "${BOLD}Meridian Setup${NC}"
echo -e "${DIM}Project: $PROJECT_DIR${NC}"
echo -e "${DIM}Network: $SOLANA_NETWORK | RPC: $SOLANA_RPC_URL${NC}"
echo ""

if [ "$RUN_DEPS" = true ]; then
  step_deps || true
fi

# Stop here if deps failed — nothing else will work
if [[ " ${FAILURES[*]:-} " == *" deps "* ]]; then
  echo ""
  error "Cannot continue — fix missing dependencies first."
  exit 1
fi

if [ "$RUN_KEYS" = true ]; then
  step_keys || true
fi

if [ "$RUN_ENV" = true ]; then
  step_env || true
fi

if [ "$RUN_INSTALL" = true ]; then
  step_install || true
fi

if [ "$RUN_BUILD" = true ]; then
  step_build || true
fi

if [ "$RUN_DEPLOY" = true ]; then
  step_deploy || true
fi

if [ "$RUN_INIT" = true ]; then
  step_init || true
fi

if [ "$RUN_FRONTEND" = true ]; then
  step_frontend || true
fi

# ===========================================================================
# Summary
# ===========================================================================
echo ""
echo -e "${BOLD}=== Setup Summary ===${NC}"
echo ""

# Show key info
if [ -f "$ADMIN_KEYPAIR_PATH" ]; then
  local_admin=$(solana-keygen pubkey "$ADMIN_KEYPAIR_PATH" 2>/dev/null || echo "unknown")
  printf "  %-22s %s\n" "Admin pubkey:" "$local_admin"
fi

if [ -f "$PROGRAM_KEYPAIR_PATH" ]; then
  local_program=$(solana-keygen pubkey "$PROGRAM_KEYPAIR_PATH" 2>/dev/null || echo "unknown")
  printf "  %-22s %s\n" "Program ID:" "$local_program"
fi

printf "  %-22s %s\n" "Network:" "$SOLANA_NETWORK"
printf "  %-22s %s\n" "RPC:" "$SOLANA_RPC_URL"
printf "  %-22s %s\n" ".env:" "$([ -f "$PROJECT_DIR/.env" ] && echo 'exists' || echo 'not created')"
printf "  %-22s %s\n" "Program binary:" "$([ -f "$PROJECT_DIR/target/deploy/meridian.so" ] && echo 'built' || echo 'not built')"

echo ""

if [ ${#FAILURES[@]} -gt 0 ]; then
  error "Some steps failed: ${FAILURES[*]}"
  echo ""
  echo "  Re-run individual steps with:"
  for f in "${FAILURES[@]}"; do
    case "$f" in
      deps*)      echo "    ./scripts/setup.sh --deps-only" ;;
      "keys"*)    echo "    ./scripts/setup.sh --keys-only" ;;
      env*)       echo "    ./scripts/setup.sh --env-only" ;;
      install*)   echo "    ./scripts/setup.sh --install-only" ;;
      build*)     echo "    ./scripts/setup.sh --build-only" ;;
      deploy*)    echo "    ./scripts/setup.sh --deploy-only" ;;
      init*)      echo "    ./scripts/setup.sh --init-only" ;;
      frontend*)  echo "    ./scripts/setup.sh --frontend-only" ;;
    esac
  done
  exit 1
else
  info "All steps completed successfully."
  echo ""
  echo "  Next steps:"
  echo "    ./scripts/deploy.sh --step=automation   # Start automation service"
  echo "    ./scripts/setup.sh --frontend-only      # Start the frontend"
  echo "    cd app && npm run dev                    # Or start frontend directly"
fi
