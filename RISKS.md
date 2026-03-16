# Risks & Limitations

## Oracle Risks

- **Pyth price staleness:** If the Pyth oracle fails to publish a fresh closing price by 4:05 PM ET, settlement retries for 15 minutes. After exhausting retries, admin must manually settle using the `admin_settle` instruction (enforces a 1-hour delay after market close).
- **Confidence band blowout:** Wide oracle confidence intervals (>1% of price) cause the on-chain settle instruction to reject the price. This protects against unreliable data but may delay settlement.
- **Pyth Benchmarks API:** The historical price endpoint used for strike calculation may be rate-limited or gated in the future. The automation service uses retry with backoff but has no secondary oracle fallback.

## Solana Network Risks

- **Devnet instability:** Solana devnet experiences periodic resets, downtime, and rate limiting. Deployed program state (config, tickers, markets) would be lost on a devnet reset.
- **Transaction failures:** Network congestion can cause transaction timeouts. The automation service retries with exponential backoff but extended outages could prevent market creation or settlement.
- **Program upgrade authority:** The admin keypair controls program upgrades. Loss of this keypair would prevent future program updates.

## Smart Contract Limitations

- **Phoenix DEX chicken-and-egg:** The YES token mint is created by `create_strike_market`, but Phoenix needs the mint to initialize an order book. Solved via an atomic 3-instruction transaction (create strike market → initialize Phoenix market → `set_phoenix_market` to link them). If any instruction fails, the entire transaction rolls back. Verified end-to-end on devnet.
- **Single admin authority:** All privileged operations (create markets, add strikes, pause, admin settle) require the same admin keypair. No multi-sig or timelocked governance.
- **No fee mechanism:** The current implementation charges no protocol fees. The vault invariant enforces exact 1:1 USDC backing with no fee extraction.
- **CPI nesting depth:** Composite instructions (buy_no_market, sell_no) use CPI calls that may hit Solana's instruction nesting limits under certain conditions.

## Market Design Limitations

- **0DTE only:** All contracts expire same-day. No multi-day or weekly contracts.
- **Fixed strike offsets:** Strikes are generated at +/-3%, +/-6%, +/-9% from previous close, rounded to $10. This is not configurable at runtime (requires code change).
- **MAG7 only:** V1 supports only 7 tickers. Adding new tickers requires an admin `register_ticker` transaction and corresponding Pyth feed ID.
- **No partial fills:** The mint-and-sell atomic operations (Buy No, Sell No) assume full execution via Phoenix CPI. Partial order book fills could leave users in intermediate states with unmatchable tokens.

## Operational Risks

- **Automation service single point of failure:** The cron-based automation service must be running for market creation and settlement. No redundancy or failover.
- **Clock drift:** Settlement timing depends on the Solana cluster clock (`Clock::unix_timestamp`). Minor drift between cluster time and wall-clock time is possible.
- **USDC dependency:** The system uses devnet faucet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). Mainnet would require Circle-issued USDC.

## What This Is Not

This is a technical demonstration and proof-of-concept. It is not financial advice, a regulated exchange, or a licensed trading platform. No regulatory or compliance claims are made. Users should not trade with real funds without understanding all risks involved.
