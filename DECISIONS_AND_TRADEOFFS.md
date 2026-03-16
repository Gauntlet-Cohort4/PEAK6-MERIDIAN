# Decisions & Trade-offs

Architecture decision rationale for BinBar (Meridian). Documents the original choice for each major decision, alternatives evaluated, trade-offs accepted, and any changes made during development.

Based on the Meridian Decision Rationale v2 (March 2026).

---

## Decision 1: Blockchain — Solana

**Original Choice:** Solana, as preferred by the project spec.

**Alternatives Evaluated:**
- EVM L2s (Arbitrum, Base)
- HyperLiquid

**Why Solana:**
- Sub-400ms slot times meet sub-second finality natively
- 162M+ daily transactions with median fees under $0.01 — cost-effective for ~42 market creations per day
- Only chain where both Phoenix (on-chain CLOB) and Pyth (permissionless US equity feeds) exist together
- One-command developer setup with Solana CLI v3.0.10 + Anchor v0.32.1
- Spec explicitly requires devnet deployment

**Why Not EVM L2s:** No mature fully on-chain CLOB comparable to Phoenix Legacy. Vertex Protocol (Arbitrum) uses an off-chain sequencer. Building a custom Solidity order book would dramatically increase scope.

**Why Not HyperLiquid:** HyperCore's order book is purpose-built for their own markets — custom binary outcome tokens cannot be plugged in. Development limited to HyperEVM which doesn't get HyperCore's performance. No documented devnet, unproven oracle integration for US equities.

**What Changed:** Agave 3.0 (the underlying validator client) increased CPI nesting depth from 4 to 8 levels. This directly de-risks the composite instruction approach used for Buy No and Sell No operations, which chain 2 levels of CPI calls. Solana CLI v3.0.10 was confirmed as the dev-recommended pin.

**Trade-off:** Solana's programming model (Rust + Anchor) has a steeper learning curve than Solidity, but the ecosystem fit (Phoenix + Pyth) makes it the only viable option for this instrument type without building custom infrastructure.

---

## Decision 2: Order Book — Phoenix Legacy

**Original Choice:** Phoenix DEX (now rebranded "Phoenix Legacy" after Ellipsis Labs pivoted to perpetuals in December 2025).

**Alternatives Evaluated:**
- OpenBook V2
- Custom-built minimal order book

**Why Phoenix Legacy:**
- Audited, open-source, backed by $44M+ in funding (Paradigm, Haun Ventures, Solana's founder)
- Clean separation of concerns: Meridian handles minting/settlement/redemption, Phoenix handles price discovery/matching
- Composable via CPI — the spec describes this exact architecture
- Permissionless market creation, crankless (instant settlement), 0.02% maker fees
- A custom order book without a security audit would be irresponsible for a system handling real money

**Why Not Custom-Built:** The spec notes that building a custom book "demonstrates deeper understanding." However, a custom book risks consuming 60%+ of development time on matching logic, partial fills, and edge cases — time better spent on bulletproof settlement invariants and a polished end-to-end demo. Deeper understanding is better demonstrated by correctly integrating Phoenix Legacy via CPI and handling the atomic Buy No flow.

**Why Not OpenBook V2:** Phoenix Legacy is crankless (no async settlement), more performant, and more composable for CPI. OpenBook V2 descends from Serum V3 and requires cranking in some configurations. However, OpenBook V2 serves as the documented fallback if Phoenix Legacy devnet presents issues.

**What Changed:** Ellipsis Labs pivoted to Phoenix Perpetuals (December 2025). Phoenix Perps is NOT usable — no permissionless custom market creation, no public SDK, no devnet support for arbitrary spot token pairs. Phoenix Legacy remains deployed, audited, and immutable on-chain. Given maintenance-mode status, the OrderBookAdapter abstraction was elevated from a "good practice" to a **hard requirement**, ensuring a future switch to OpenBook V2 is a contained change.

**Trade-off:** Phoenix Legacy is infrastructure consumed via CPI, not code owned by Meridian. This is equivalent to using AWS or Stripe. The core Meridian smart contract (all minting, settlement, redemption, invariant logic) is 100% owned. If Phoenix Legacy were deprecated, migrating to OpenBook V2 is a contained change — the OrderBookAdapter abstraction isolates the dependency.

---

## Decision 3: Oracle — Pyth Network

**Original Choice:** Pyth Network over Chainlink Data Streams.

**Alternatives Evaluated:**
- Chainlink Data Streams

**Why Pyth:**
- Free and permissionless — Chainlink Data Streams uses subscription-based billing gated behind a sales process
- Solana-native: built on Solana infrastructure (Pythnet) with purpose-built Anchor SDK (`pyth-solana-receiver-sdk`)
- Publishes confidence intervals with every update as a core data model feature
- Documented devnet feed addresses and starter kit for Anchor
- Integrated by 600+ protocols across 100+ blockchains

**Key Architecture Detail — Dual Staleness Thresholds:** The spec mentions "staleness check" as a single concept, but Meridian needs two different thresholds:
- **On-chain settlement:** Strict 5-minute threshold (price was just published)
- **Off-chain morning job:** Reads a ~16-hour-old price (last night's close) via the Pyth Benchmarks API `/v1/updates/price/{timestamp}`, which returns historical prices by timestamp and avoids the staleness issue entirely

**Pyth Previous Close Persistence:** US equity price feeds stop updating outside market hours, but the last published price remains in the on-chain account (not deleted or zeroed). The Pyth SDK's `get_price_no_older_than` method rejects stale reads by design, so the morning read uses the off-chain Hermes Benchmarks API.

**What Changed:**
- Chainlink Data Streams launched US equity + ETF feeds (August 2025) across 37 blockchain networks, then expanded to 24/5 coverage (January 2026). Chainlink now provides pre-market, after-hours, and overnight pricing with metadata including market status flags and bid/ask spreads. For a production deployment, Chainlink would be a strong secondary oracle.
- Pyth Benchmarks API endpoint `/v1/updates/price/{timestamp}` was confirmed via research for historical price retrieval.
- Pyth Solana Receiver SDK was upgraded to anchor-lang 0.31.1 (February 2026). Meridian targets Anchor 0.32.1. The 0.31-to-0.32 changes are mostly additive. Decision: try 0.32.1 first, patch Cargo.toml if needed.

**Trade-off:** Pyth is free and permissionless but has narrower coverage (market hours only for equities). Chainlink offers 24/5 coverage and institutional credibility (partners with Swift, Euroclear, DTCC) but requires a paid subscription. For V1 on devnet, Pyth is the clear choice. For production, Chainlink as a secondary oracle would be justified by the additional coverage.

---

## Decision 4: Frontend Stack — Next.js + Wallet Adapter

**Original Choice:** Next.js (App Router) + TypeScript, as specified by project requirements.

**Sub-decisions:**

### Wallet Integration

The Solana ecosystem has two wallet integration paths. The implementation uses `@solana/wallet-adapter-react` with explicit wallet listing for Phantom and Solflare. The newer Solana Foundation-recommended stack (`@solana/react-hooks` + `@solana/kit`) was evaluated — confirmed stable at pinned versions (@solana/client@1.1.0, @solana/react-hooks@1.1.0, @solana/kit@5.0.0).

### Phoenix Legacy SDK Interop Layer

The Phoenix Legacy TypeScript SDK (`@ellipsis-labs/phoenix-sdk`) imports from `@solana/web3.js` (legacy types: PublicKey, Transaction, Connection). The frontend uses `@solana/wallet-adapter-react`. A thin interop layer in a single file (`lib/adapters/phoenix-interop.ts`) handles all type conversions at the Phoenix boundary. No other file imports `@solana/web3.js` directly. The interop layer includes conditional debug logging (OFF by default) controlled by `MERIDIAN_DEBUG_PHOENIX_INTEROP`.

### Styling

Tailwind CSS + shadcn/ui provides copy-paste components (not a dependency) built on Tailwind + Radix primitives, keeping the bundle small and components customizable. For a solo developer with AI assistance, this stack maximizes iteration speed.

**Trade-off:** The interop layer adds a maintenance surface between two Solana type systems. This is acceptable because it's contained to a single file, and the alternative (rewriting the Phoenix SDK) would be impractical.

---

## Decision 5: Automation Service — node-cron

**Original Choice:** node-cron (in-process scheduler).

**Alternatives Evaluated:**
- Cloud schedulers (AWS EventBridge)
- Job queues (BullMQ, Temporal)

**Why node-cron:**
- No infrastructure dependency — fully reproducible locally
- Each job is a standalone testable function with retry logic built into the function (not the scheduler)
- Structured for easy migration to a cloud scheduler later
- Cloud schedulers add infrastructure dependency and are harder to reproduce locally
- Job queues require Redis or a Temporal server — overkill for two daily cron jobs

**Trading Day Detection:** Finnhub's Market Holiday API (free tier, 60 req/min) provides the NYSE holiday calendar. A hardcoded 2026 holiday array serves as fallback if the API is unreachable. This dual-source pattern (live API + static fallback) demonstrates production thinking without over-engineering.

**Demo Mode:** The system adapts rather than using a binary toggle. During market hours on trading days, it uses live Pyth data. Outside those hours with `DEMO_MODE=true`, it uses ephemeral price data. The evaluator sees the full oracle integration path regardless of when they run the demo.

**Rate Limiting:** Creating ~42 markets each morning (7 tickers x 6 strikes) means ~42 transactions in quick succession. Transactions are sent sequentially with ~500ms delay, using `confirmTransaction` to wait before sending the next.

**Trade-off:** node-cron is a single point of failure with no redundancy or failover. For production, migration to a cloud scheduler with monitoring would be required. For a devnet proof-of-concept, the simplicity advantage outweighs the reliability concern.

---

## Decision 6: Testing Framework — Vitest + LiteSVM

**Original Choice:** LiteSVM for on-chain tests, Vitest + React Testing Library for frontend.

**Alternatives Evaluated:**
- Bankrun (deprecated March 2025)
- solana-test-validator
- Playwright/Cypress for E2E

**Why LiteSVM:**
- Official replacement for Bankrun, current Solana ecosystem standard
- In-process Solana VM that's orders of magnitude faster than solana-test-validator
- Time travel (critical for testing the 1-hour admin override delay and 4:00 PM settlement gate)
- Arbitrary account data injection (mocking Pyth oracle accounts with specific prices/confidence)
- Balance manipulation (giving test accounts USDC without the mint keypair)
- Confirmed stable in both Rust and TypeScript (npm package: `litesvm`)

**Surfpool for CPI Tests:** Tests involving Phoenix Legacy CPI require Phoenix's program to be loaded. Surfpool (v0.12.0) supports loading external programs from mainnet on-demand for local CPI testing. Pure Meridian program logic tests use LiteSVM for speed.

**No E2E Browser Tests:** Playwright/Cypress tests are intentionally omitted:
1. Wallet extension interaction (Phantom/Solflare popup approval) requires browser extension mocking with low signal-to-noise ratio
2. Every meaningful E2E test requires on-chain state (deployed program, created market, funded wallet, active order book liquidity), making setup cost per test enormous
3. The demo script validates the same create-mint-trade-settle-redeem flow with real transactions
4. Critical correctness concerns (invariant violations, settlement edge cases, oracle staleness) are all on-chain and covered by LiteSVM unit tests

Frontend testing uses Vitest + React Testing Library for all component, hook, and utility logic.

**Trade-off:** No browser automation means UI regressions could slip through. This is mitigated by component-level RTL tests and the manual demo script. For a Solana dApp, the on-chain correctness concerns are far more critical than pixel-perfect UI testing.

---

## Architectural Gaps & Mitigations

| Gap | Issue | Mitigation |
|-----|-------|------------|
| Phoenix Legacy Devnet | Permissionless on mainnet, needs verification on devnet. Now in maintenance mode. | Test early. If blocked, switch to OpenBook V2. OrderBookAdapter is a hard requirement. |
| Dual Staleness Thresholds | Morning reads and settlement reads have different freshness requirements. | On-chain settlement: 300s threshold. Off-chain morning: Hermes Benchmarks API. |
| Atomic Buy No + No Liquidity | If no bids exist on Phoenix when user tries Buy No, the atomic mint-and-sell fails. | Market order fails gracefully. Limit order mints pair and posts sell — user holds both tokens until fill. |
| Token Account Management | 42 markets/day x 2 tokens = 84 potential ATAs per user. | Use `init_if_needed` in Anchor. Adds small cost to first trade. |
| Timezone Handling | Settlement depends on 4:00 PM ET. System timezone varies. | Use `date-fns-tz` for explicit ET handling. Never rely on system `Date()`. |
| Phoenix Legacy Market Rent | Each market allocates account space (rent in SOL). 42 markets/day accumulates. | Devnet: free (airdropped SOL). Production: close stale markets to reclaim rent. |
| Fee Architecture | Vault must be exact ($1.00 x pairs). No room for fees. | V1 has zero fees. Production adds fees to separate account. |
| Indefinite Redemption | Unredeemed tokens and vaults persist forever, consuming rent. | Flag as production concern. Add admin garbage collection. |
| Pyth SDK Version Gap | Pyth SDK uses anchor-lang 0.31.1. Meridian targets 0.32.1. | Try 0.32.1 first. Patch Cargo.toml if minor. Escalate if unfixable. |
| Phoenix SDK Interop Types | Phoenix SDK uses `@solana/web3.js`. Frontend uses different types. | Thin interop layer in single file with conditional debug logging. |

---

## Demo vs. Production Considerations

| Aspect | Demo / Devnet | Production |
|--------|--------------|------------|
| Oracle data | Pyth devnet feeds or DEMO_MODE ephemeral accounts | Pyth mainnet + Chainlink Data Streams as secondary |
| Order book | Phoenix Legacy devnet (or OpenBook V2 fallback) | Phoenix Legacy mainnet or OpenBook V2 with real liquidity |
| USDC | Devnet mock USDC (SPL token faucet) | Real USDC on Solana mainnet |
| RPC provider | Free public devnet endpoint | Private RPC (Helius/QuickNode) |
| Admin authority | Single keypair in .env | Multi-sig (Squads) |
| Fees | Zero fees | Protocol fee to separate account |
| Alerting | Console logs | PagerDuty/Slack webhooks |
| Monitoring | Script output | Structured logging + dashboards |
| Holiday detection | Finnhub free tier + hardcoded list | Finnhub or TradingHours.com paid API |
| Market creation | ~42 markets/day sequential | Parallel with priority fees + private RPC |
| State cleanup | None (devnet resets) | Automated rent reclamation |
| Security audit | Self-reviewed + AI-assisted | Professional audit (Neodyme, OtterSec) |
| Debug logging | `MERIDIAN_DEBUG_ALL=true` for troubleshooting | All debug flags OFF, structured production logging only |
