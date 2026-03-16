# BinBar

Binary options prediction market on Solana, built by PEAK6.

Traders bet on whether MAG7 equities (AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA) will close above or below a strike price on a given trading day. Markets are created each morning with strikes derived from the previous close, traded throughout the day via the Phoenix DEX on-chain order book, and settled at market close using Pyth oracle prices. Winners redeem tokens 1:1 for USDC.

**Deployed on Solana devnet** at [`DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE`](https://explorer.solana.com/address/DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE?cluster=devnet). No mainnet or real funds are used.

## Architecture

```
                        +-------------------+
                        |   Next.js App     |
                        |  (React + Hooks)  |
                        +--------+----------+
                                 |
                        TX Builders (mint, buy, sell, redeem)
                                 |
                        Phoenix Interop Layer
                                 |
              +------------------+------------------+
              |                                     |
    +---------v---------+             +-------------v-----------+
    |  Meridian Program |             |     Phoenix DEX         |
    |  (Anchor/Solana)  |<--- CPI -->|  (Order Book for NO)    |
    +---+----------+----+             +-------------------------+
        |          |
   +----v----+ +---v---------+
   | YES/NO  | | USDC Vault  |
   | Tokens  | | (SPL Token) |
   +---------+ +-------------+
        ^
        |  Oracle prices
   +----+--------+
   | Pyth Network|
   +-------------+
        ^
        |  Price feeds
   +----+-----------+
   | Automation Svc |
   | (Cron Jobs)    |
   +----------------+
     Morning: create markets + Phoenix order books
     Evening: settle markets via oracle
```

## How It Works

1. **Morning Job** (8:00 AM ET, weekdays): Fetches the previous close from Pyth Benchmarks, calculates 7 strike levels per ticker (+/-3%, +/-6%, +/-9% from close, rounded to $10), and creates each strike market atomically in a single Solana transaction:
   - Instruction 1: `create_strike_market` — creates the market PDA, YES/NO token mints, and USDC vault
   - Instruction 2: Phoenix `InitializeMarket` — creates a permissionless order book with YES as base and USDC as quote
   - Instruction 3: `set_phoenix_market` — links the Phoenix order book address to the strike market

2. **Trading** (9:30 AM – 4:00 PM ET): Users interact through four operations:
   - **Buy YES**: Mint a YES+NO pair (1 USDC) and keep the YES token
   - **Buy NO**: Mint a pair, then sell the YES token on Phoenix for USDC, keeping the NO token
   - **Sell YES**: Sell YES tokens on the Phoenix order book
   - **Sell NO**: Buy YES from Phoenix, then burn YES+NO to reclaim 1 USDC

3. **Settlement** (4:05 PM ET): The automation service fetches the closing price from Pyth. If close >= strike, YES wins; otherwise NO wins. Fallback: admin can force-settle after a 1-hour delay if the oracle is unavailable.

4. **Redemption** (after settlement): Winners burn their tokens and receive 1 USDC each from the vault. Losers' tokens are worthless.

## Project Structure

```
meridian/
  programs/        Anchor smart contract (Rust, 14 instructions)
  automation/      Cron job service (morning creation + evening settlement)
  app/             Next.js frontend with trading UI
  shared/          Shared types, constants, logger, debug flags
  scripts/         Deploy, lifecycle test, and setup scripts
  tests/           Integration tests
```

## Deploy & Run Full Lifecycle

Follow these steps to deploy Meridian from scratch and run the complete create → mint → settle → redeem lifecycle on Solana devnet.

### Step 1: Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 20 | [nodejs.org](https://nodejs.org) |
| Solana CLI | v3.0.10 (Agave) | `sh -c "$(curl -sSfL https://release.anza.xyz/v3.0.10/install)"` |
| Anchor CLI | v0.32.1 | `cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli` |
| Rust | latest stable | [rustup.rs](https://rustup.rs) |

> **Windows users**: Run all commands inside WSL 2 (Ubuntu). The Solana CLI and Anchor do not support native Windows.

### Step 2: Clone and Install

```bash
git clone <repo-url> meridian
cd meridian
npm install
```

### Step 3: Generate a Keypair and Fund It

```bash
solana-keygen new --outfile ~/.config/solana/meridian-admin.json
solana config set --url https://api.devnet.solana.com
solana config set --keypair ~/.config/solana/meridian-admin.json

# Airdrop SOL (run multiple times if needed, wait between requests)
solana airdrop 5
solana airdrop 5
```

You need at least 10 SOL for program deployment and market creation.

### Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Value |
|----------|-------|
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` (default) |
| `ADMIN_KEYPAIR_PATH` | `~/.config/solana/meridian-admin.json` |
| `FINNHUB_API_KEY` | Free key from [finnhub.io/register](https://finnhub.io/register) |

All other variables have sensible defaults. See `.env.example` for the full list.

### Step 5: Deploy

```bash
./scripts/deploy.sh
```

This script:
1. Builds the Anchor program (`anchor build`)
2. Deploys to Solana devnet
3. Initializes the Meridian config PDA
4. Registers all 7 tickers with Pyth feed IDs
5. Uploads the IDL

Use `./scripts/deploy.sh --test` to deploy and run the lifecycle test in one step.

### Step 6: Run the Full Lifecycle Test

```bash
npx tsx scripts/test-full-pipeline.ts
```

This exercises the complete on-chain flow:

| Step | Action | What Happens |
|------|--------|-------------|
| 1 | Create USDC mint | Mints test USDC and funds the admin wallet |
| 2 | Create strike market | Creates market PDA with YES/NO mints and USDC vault |
| 3 | Create Phoenix market | Initializes a Phoenix order book (YES/USDC pair) |
| 4 | Link markets | Calls `set_phoenix_market` to connect them |
| 5 | Mint pairs | Deposits USDC, receives YES + NO tokens |
| 6 | Settle | Admin settles after market close window elapses |
| 7 | Redeem | Burns winning tokens, withdraws USDC from vault |

Steps 1–5 confirm immediately. Step 6 requires the settlement window to elapse (market close + 1 hour). The script reports the wait and exits cleanly.

### Step 7: Start the Frontend

```bash
cd app
npm run dev
```

Open [http://localhost:3002](http://localhost:3002). Connect a Solana wallet (Phantom or Solflare) configured for devnet.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| `solana airdrop` fails | Wait 30s and retry. Devnet faucet is rate-limited. |
| Deploy fails with "insufficient funds" | Airdrop more SOL: `solana airdrop 5` |
| `test-full-pipeline.ts` times out | Public devnet RPC can be slow. Use a dedicated RPC (Helius, QuickNode). |
| Frontend shows no markets | Run the lifecycle test first to create markets on-chain. |
| Wallet won't connect | Ensure wallet is set to **devnet**, not mainnet. |

## Technology Choices & Justifications

Each major dependency was evaluated against alternatives. Full rationale is in `Meridian_Decision_Rationale_V2.pdf`.

### Solana

Selected over EVM L2s (Arbitrum, Base) and HyperLiquid:
- **Sub-400ms finality** meets the sub-second settlement requirement natively
- **Median fees under $0.01** — cost-effective for ~42 market creations per day
- **Only chain** where Phoenix (on-chain CLOB) and Pyth (permissionless US equity feeds) both exist
- EVM L2s lack a mature fully on-chain CLOB comparable to Phoenix; HyperLiquid's order book cannot accept custom tokens

### Anchor Framework

Standard Rust framework for Solana programs:
- **Account validation macros** eliminate missing signer checks and ownership bugs
- **IDL generation** keeps TypeScript client bindings in sync with the contract
- Agave 3.0 increased CPI nesting depth from 4 to 8, enabling the composite Buy NO / Sell NO instructions

### Phoenix DEX

Phoenix Legacy (Ellipsis Labs) chosen over OpenBook V2 and a custom order book:
- **Audited, open-source**, backed by Paradigm and Solana Ventures
- **Crankless** — instant settlement, no external keepers needed
- **Composable via CPI** — Meridian handles minting/settlement, Phoenix handles price discovery
- **Permissionless market creation** — any signer can create a market
- A custom order book would consume 60%+ of development time and lack a security audit
- Phoenix Legacy is in maintenance mode; an **OrderBookAdapter abstraction** ensures a future switch to OpenBook V2 is contained

### Pyth Network

Chosen over Chainlink Data Streams:
- **Free and permissionless** — Chainlink requires subscription billing gated behind a sales process
- **Solana-native** with purpose-built Anchor SDK (`pyth-solana-receiver-sdk`)
- **Dual staleness thresholds**: on-chain settlement uses a strict 5-minute window; the morning job reads historical closes via the Benchmarks API
- 600+ protocols across 100+ blockchains

### Next.js + React

- **Wallet integration** via `@solana/wallet-adapter-react` for Phantom, Solflare, Backpack
- **Phoenix interop layer** bridges the Phoenix SDK with the frontend
- **Tailwind CSS + shadcn/ui** for lightweight, customizable components

### Automation (node-cron)

Chosen over cloud schedulers (AWS EventBridge) and job queues (BullMQ, Temporal):
- No infrastructure dependency — fully reproducible locally
- Each job is a standalone testable function with retry logic
- **Finnhub Market Holiday API** for trading day detection with hardcoded 2026 fallback

### Testing (Vitest)

- **450+ tests** across 45 test files
- **Vitest + React Testing Library** for frontend components and hooks
- **Integration tests** validate the full morning-job and settlement-job pipelines with mock adapters

## Available Commands

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make build` | Build all packages |
| `make test` | Run all tests |
| `make deploy` | Build and deploy Anchor program |
| `make setup-devnet` | One-time devnet environment setup |
| `make clean` | Remove build artifacts and node_modules |

## Environment Variables

All secrets are managed via environment variables. See `.env.example` for the complete list with descriptions and default values. No secrets are hardcoded in the source.

Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `ADMIN_KEYPAIR_PATH` | Yes | Path to admin keypair JSON |
| `PROGRAM_ID` | Yes | Deployed Meridian program ID |
| `FINNHUB_API_KEY` | Yes | Trading calendar API key |
| `PYTH_HERMES_URL` | No | Pyth price feed endpoint (default: hermes.pyth.network) |
| `SOLANA_CLUSTER` | No | devnet / localnet (default: devnet) |

## Risks & Limitations

See [RISKS.md](RISKS.md) for a detailed assessment covering oracle risks, network risks, smart contract limitations, and operational risks.

## License

Proprietary — PEAK6 Investments
