/**
 * @module constants
 * All magic numbers and configuration values for the Meridian platform.
 * Centralised here to prevent duplication and make auditing easy.
 */

/** Platform-wide configuration constants. */
export const MERIDIAN_CONFIG = {
  /** Maximum age of an oracle price before it is considered stale (seconds). */
  STALENESS_THRESHOLD_SECONDS: 300,

  /** Maximum acceptable confidence interval from the oracle (basis points). */
  CONFIDENCE_THRESHOLD_BPS: 100,

  /** Interval between oracle retry attempts (milliseconds). */
  ORACLE_RETRY_INTERVAL_MS: 30_000,

  /** Maximum number of oracle retry attempts before giving up. */
  ORACLE_MAX_RETRIES: 30,

  /** Percentage offsets from spot price for strike generation. */
  STRIKE_OFFSETS_PERCENT: [3, 6, 9],

  /** Rounding granularity for strike prices (dollars). */
  STRIKE_ROUNDING: 10,

  /** NYSE market open hour (ET). */
  MARKET_OPEN_HOUR: 9,
  /** NYSE market open minute (ET). */
  MARKET_OPEN_MINUTE: 30,
  /** NYSE market close hour (ET). */
  MARKET_CLOSE_HOUR: 16,
  /** NYSE market close minute (ET). */
  MARKET_CLOSE_MINUTE: 0,

  /** Hour to run the morning market creation job (ET). */
  MORNING_JOB_HOUR: 8,
  /** Minute to run the morning market creation job (ET). */
  MORNING_JOB_MINUTE: 0,
  /** Hour to run the settlement job (ET). */
  SETTLEMENT_JOB_HOUR: 16,
  /** Minute to run the settlement job (ET). */
  SETTLEMENT_JOB_MINUTE: 5,

  /** Delay between sequential on-chain transactions (milliseconds). */
  INTER_TX_DELAY_MS: 500,
  /** Maximum retries when creating/settling a single market. */
  MAX_RETRIES_PER_MARKET: 5,

  /** Minimum wait before admin can force-settle a market (seconds). */
  ADMIN_SETTLE_DELAY_SECONDS: 3600,

  /** Equity tickers supported at launch. */
  SUPPORTED_TICKERS: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'] as const,

  /** USDC token decimal places. */
  USDC_DECIMALS: 6,
  /** Outcome token decimal places. */
  OUTCOME_TOKEN_DECIMALS: 6,
  /** Cost of one YES+NO token pair in USDC lamports (1 USDC). */
  PAIR_COST_USDC: 1_000_000,
} as const;

/** Type-safe ticker literal union. */
export type SupportedTicker = (typeof MERIDIAN_CONFIG.SUPPORTED_TICKERS)[number];

/**
 * Pyth Hermes price feed IDs for supported tickers.
 * Source: https://hermes.pyth.network/api/latest_price_feeds
 */
export const PYTH_FEED_IDS: Readonly<Record<SupportedTicker, string>> = {
  AAPL: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  MSFT: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  GOOGL: '5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6',
  AMZN: 'b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
  NVDA: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
  META: '78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  TSLA: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
};
