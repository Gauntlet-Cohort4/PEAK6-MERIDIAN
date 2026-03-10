# Integration Tests

## Overview

Integration tests validate the full Meridian lifecycle on a local Solana validator. They exercise the contract, automation, and frontend transaction builders together against a real (but local) Solana runtime.

## Test Environment: Surfpool

We use [Surfpool](https://github.com/txtx/surfpool) as our local Solana validator. Surfpool provides a lightweight, fast-starting Solana runtime that supports:

- Program deployment
- SPL Token operations
- CPI (Cross-Program Invocation) for Phoenix DEX integration
- Pyth oracle account simulation

### Prerequisites

1. Install Surfpool: `cargo install surfpool`
2. Install Anchor CLI: `cargo install --git https://github.com/coral-xyz/anchor anchor-cli`
3. Build the Meridian program: `anchor build`

### Starting Surfpool

```bash
surfpool start --reset
```

This starts a clean local validator on `http://localhost:8899`.

## Test Lifecycle

Integration tests follow the full market lifecycle:

1. **Deploy** - Deploy the Meridian program to localnet
2. **Initialize** - Create the config PDA with admin authority
3. **Register Tickers** - Register AAPL, NVDA (subset for speed)
4. **Create Markets** - Morning job creates strike markets
5. **Mint Pairs** - Deposit USDC, receive YES + NO tokens
6. **Trade** - Place orders on Phoenix for NO tokens
7. **Settle** - Settlement job settles markets via oracle
8. **Redeem** - Burn winning tokens for USDC

## Running Integration Tests

```bash
# Start Surfpool in one terminal
surfpool start --reset

# Run integration tests in another terminal
SOLANA_CLUSTER=localnet make test-integration

# Or run the demo script
SOLANA_CLUSTER=localnet make demo
```

## Test Data

- Admin keypair: `~/.config/solana/id.json` (auto-generated)
- USDC: Uses devnet USDC mint or a locally-created SPL token
- Pyth feeds: Simulated via account writes on localnet

## Troubleshooting

### Surfpool fails to start
- Ensure no other process is using port 8899
- Try `surfpool start --reset` to clear state

### Program deployment fails
- Run `anchor build` first
- Check `target/deploy/` for the program keypair

### Oracle price stale errors
- On localnet, manually write Pyth price accounts before settling
- Use `solana account --output json` to inspect account state

## Future: CI Integration

Once Surfpool supports Docker, integration tests will run in CI:

```yaml
# .github/workflows/integration.yml (planned)
jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      surfpool:
        image: txtx/surfpool:latest
        ports: ["8899:8899"]
    steps:
      - uses: actions/checkout@v4
      - run: make deploy SOLANA_CLUSTER=localnet
      - run: make test-integration SOLANA_CLUSTER=localnet
```
