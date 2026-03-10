/// Oracle staleness threshold in seconds (5 minutes).
pub const STALENESS_THRESHOLD: i64 = 300;

/// Oracle confidence interval threshold in basis points (1%).
pub const CONFIDENCE_THRESHOLD_BPS: u64 = 100;

/// Delay in seconds before admin can force-settle (1 hour after 4:05 PM ET).
pub const ADMIN_SETTLE_DELAY: i64 = 3600;

/// Cost per pair in USDC base units (1 USDC = 1_000_000 lamports).
pub const PAIR_COST_LAMPORTS: u64 = 1_000_000;

/// USDC decimal places.
pub const USDC_DECIMALS: u8 = 6;

/// Outcome token decimal places (matches USDC for 1:1 ratio).
pub const OUTCOME_TOKEN_DECIMALS: u8 = 6;

/// Maximum length of a ticker symbol in bytes.
pub const MAX_SYMBOL_LEN: usize = 10;

/// Seed prefix for the global config PDA.
pub const CONFIG_SEED: &[u8] = b"config";

/// Seed prefix for ticker config PDAs.
pub const TICKER_SEED: &[u8] = b"ticker";

/// Seed prefix for strike market PDAs.
pub const MARKET_SEED: &[u8] = b"market";

/// Seed prefix for yes-token mint PDAs.
pub const YES_MINT_SEED: &[u8] = b"yes_mint";

/// Seed prefix for no-token mint PDAs.
pub const NO_MINT_SEED: &[u8] = b"no_mint";

/// Seed prefix for vault PDAs.
pub const VAULT_SEED: &[u8] = b"vault";

/// Phoenix Legacy program ID.
pub const PHOENIX_PROGRAM_ID: &str = "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY";

/// Market close time: 4:05 PM ET expressed as seconds from midnight UTC.
/// 4:05 PM ET = 21:05 UTC (during EST; 20:05 during EDT).
/// We use the EST variant (worst-case later time).
pub const MARKET_CLOSE_SECONDS_UTC: i64 = 75_900; // 21 * 3600 + 5 * 60
