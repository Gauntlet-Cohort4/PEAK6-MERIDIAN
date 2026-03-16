# Changelog

All notable changes to Meridian are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

#### Atomic Phoenix Market Creation
- `set_phoenix_market` on-chain instruction — admin instruction to link a Phoenix DEX order book to an existing strike market, solving the chicken-and-egg problem (Phoenix needs the YES mint, which is created by `create_strike_market`)
- Atomic 3-instruction transaction flow: `create_strike_market` → Phoenix `InitializeMarket` → `set_phoenix_market`, all in a single Solana transaction with full rollback on failure
- `PhoenixMarketFactory` interface with `buildCreateMarketIxs` for composing Phoenix instructions
- `MeridianClient` instruction builders: `buildCreateStrikeMarketIx`, `buildSetPhoenixMarketIx`, `sendInstructions` for multi-instruction composition
- `demo-mode` Cargo feature flag — compile-time toggle for 5-second settlement delays (testing only)

#### Deployment & Lifecycle Testing
- `scripts/deploy.sh` — one-command deployment: build, deploy, init config, register tickers, upload IDL. Supports `--test` flag
- `scripts/test-full-pipeline.ts` — end-to-end devnet test: create market → Phoenix order book → link → mint pairs → settle → redeem
- Full pipeline verified on Solana devnet with real transactions

#### Frontend Fixes
- Toast notification system (React context, auto-dismiss, max 5 stacked)
- Live balance tracking — header USDC balance updates on trades, mints, and redemptions
- Settled market UI — trade panel replaced with outcome card when market is settled
- Wallet connection fix — `select()` + `connect()` flow for Solflare/Phantom with `autoConnect=false`
- Wallet dropdown closes on route navigation
- Demo Mode badge contrast fixed for WCAG AA compliance
- Heading hierarchy fixed (h1 → h2 on home page)

### Fixed
- Trade execution crash — `buildDemoTransactionForOrder` was not async, causing silent unhandled promise rejections
- BUY_NO balance deduction — was deducting contract count instead of `contracts * price`
- NaN balance corruption — `creditBalance`/`deductBalance` now validate with `isFinite()` guard
- Toast stacking — capped at 5 to prevent unbounded DOM growth
- Next.js dev server crash (Jest worker child process exceptions) — corrupted `.next` cache

### Changed
- Morning job refactored — `processTicker` supports atomic path (with Phoenix factory) and fallback path (placeholder address)
- `TransactionSender.sendAndConfirm` accepts single or array of `TransactionInstruction`
- RISKS.md updated — removed outdated Phoenix placeholder language, documented atomic transaction solution
- README rewritten — deployment guide, lifecycle test instructions, technology justifications, architecture docs

---

## [0.1.0] — Initial Release

### Smart Contract (Anchor/Rust)
- 14 on-chain instructions: initialize_config, register_ticker, create_strike_market, set_phoenix_market, mint_pair, buy_no_limit, buy_no_market, sell_no, settle_market, admin_settle, redeem, pause, unpause
- PDA-based account derivation for config, tickers, markets, mints, and vaults
- Phoenix DEX CPI integration for NO token order matching
- Pyth oracle integration with staleness and confidence thresholds
- Deployed to devnet at `DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE`

### Automation Service
- Morning job: fetch previous close from Pyth Benchmarks, calculate 7 strike levels per ticker, create markets
- Settlement job: fetch closing price from Pyth Hermes, settle markets, admin fallback with 1-hour delay
- Retry with exponential backoff on all RPC and oracle calls
- Trading day detection via Finnhub Market Holiday API (2026 hardcoded fallback)
- Structured JSON logging with per-module debug flags

### Frontend (Next.js 15 / React 19)
- Trading dashboard with live Pyth prices, order books, trade panel
- Markets page with ticker filtering and contract details
- Portfolio page with active/settled positions and redemption
- History page with transaction log
- Custom wallet selector (Phantom, Solflare) with animated swap
- Trade confirmation dialog with cost/profit breakdown

### Infrastructure
- Monorepo: shared/, programs/, automation/, app/, scripts/
- 450+ tests across 45 test files (Vitest)
- Adapter pattern for all external services (price, trading day, order book)
- `.env.example` with all configuration documented
- Makefile with build, test, deploy, and setup targets
- 7 tickers registered: AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA
