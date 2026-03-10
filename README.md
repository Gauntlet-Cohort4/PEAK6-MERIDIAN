# Meridian

Binary options prediction market on Solana, built by PEAK6.

Traders bet on whether equities (AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA) will close above or below a strike price on a given trading day. Markets are created each morning, settled at market close using Pyth oracle prices, and traded via the Phoenix DEX.

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
     Morning: create markets
     Evening: settle markets
```

## Project Structure

```
meridian/
  shared/          Shared types, constants, logger, errors, debug flags
  programs/        Anchor smart contract (Solana program)
  automation/      Cron job service (morning creation + evening settlement)
  app/             Next.js frontend with trade UI
  scripts/         Deploy, demo, and setup scripts
  tests/           Integration test documentation
```

## Quick Start

### Prerequisites

- Node.js >= 20
- Solana CLI
- Anchor CLI
- Surfpool (for local development)

### Install

```bash
make install
```

### Run Tests

```bash
# All tests
make test

# Individual workspaces
make test-automation
make test-frontend
make test-integration
```

### Devnet Setup

```bash
# One-time setup: airdrop SOL, create USDC accounts, register tickers
make setup-devnet

# Deploy program
make deploy

# Run full lifecycle demo
make demo
```

### Local Development

```bash
# Start local validator
surfpool start --reset

# Deploy locally
SOLANA_CLUSTER=localnet make deploy

# Run demo against local validator
SOLANA_CLUSTER=localnet make demo
```

## Available Commands

| Command             | Description                                   |
|---------------------|-----------------------------------------------|
| `make install`      | Install all dependencies                      |
| `make build`        | Build all packages                            |
| `make test`         | Run all tests                                 |
| `make test-automation` | Run automation service tests               |
| `make test-frontend`| Run frontend tests                            |
| `make lint`         | Lint all TypeScript files                     |
| `make format`       | Format all files with Prettier                |
| `make demo`         | Run full lifecycle demo script                |
| `make deploy`       | Build and deploy Anchor program               |
| `make setup-devnet` | One-time devnet environment setup             |
| `make clean`        | Remove all build artifacts and node_modules   |

## Tech Stack

- **Smart Contract**: Anchor (Rust) on Solana
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Automation**: Node.js cron service with Zod config validation
- **Order Book**: Phoenix DEX (on-chain CLOB)
- **Oracle**: Pyth Network (Hermes API + on-chain price feeds)
- **Testing**: Vitest, Testing Library, Surfpool (local Solana)
- **Shared**: Structured JSON logging, debug flags, error types, tracing

## Environment Variables

| Variable                      | Required | Default                          | Description                          |
|-------------------------------|----------|----------------------------------|--------------------------------------|
| `SOLANA_RPC_URL`              | Yes      | -                                | Solana RPC endpoint                  |
| `ADMIN_KEYPAIR_PATH`          | Yes      | -                                | Path to admin keypair JSON file      |
| `PROGRAM_ID`                  | Yes      | -                                | Deployed Meridian program ID         |
| `PYTH_HERMES_URL`             | No       | `https://hermes.pyth.network`    | Pyth Hermes API endpoint             |
| `PYTH_BENCHMARKS_URL`         | No       | `https://benchmarks.pyth.network`| Pyth Benchmarks API endpoint         |
| `FINNHUB_API_KEY`             | Yes      | -                                | Finnhub API key (trading calendar)   |
| `DEMO_MODE`                   | No       | `false`                          | Enable demo mode with mock data      |
| `SOLANA_CLUSTER`              | No       | `devnet`                         | Cluster: devnet, localnet, mainnet   |
| `MERIDIAN_LOG_LEVEL`          | No       | `INFO`                           | Log level: DEBUG, INFO, WARN, ERROR  |
| `MERIDIAN_DEBUG_PHOENIX_INTEROP` | No    | `false`                          | Debug Phoenix interop layer          |
| `MERIDIAN_DEBUG_ADAPTERS`     | No       | `false`                          | Debug adapter calls                  |
| `MERIDIAN_DEBUG_TX`           | No       | `false`                          | Debug transaction building           |
| `MERIDIAN_DEBUG_ORACLE`       | No       | `false`                          | Debug oracle reads                   |
| `MERIDIAN_DEBUG_CRON`         | No       | `false`                          | Debug cron job execution             |
| `MERIDIAN_DEBUG_ORDERBOOK`    | No       | `false`                          | Debug order book operations          |
| `MERIDIAN_DEBUG_ALL`          | No       | `false`                          | Enable all debug flags               |

## Development Workflow

1. **Morning Job** (8:00 AM ET, weekdays): Fetches previous close prices from Pyth, calculates 7 strike levels per ticker, creates Phoenix markets and Meridian strike market PDAs.

2. **Trading** (9:30 AM - 4:00 PM ET): Users mint YES+NO token pairs (1 USDC each), trade NO tokens on Phoenix order book, or buy/sell positions.

3. **Settlement Job** (4:05 PM ET): Fetches closing prices from Pyth oracle, settles each market (YES wins if close >= strike), falls back to admin settlement if oracle unavailable.

4. **Redemption** (after settlement): Winners redeem tokens for 1 USDC each, losers' tokens are burned.

## License

Proprietary - PEAK6 Investments
