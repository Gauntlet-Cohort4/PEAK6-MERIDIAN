use anchor_lang::prelude::*;

use crate::constants::MAX_SYMBOL_LEN;

/// Global program configuration. Singleton PDA seeded by `["config"]`.
#[account]
pub struct MeridianConfig {
    /// The admin authority who can manage tickers, pause, and force-settle.
    pub admin: Pubkey,

    /// Whether the program is paused (blocks minting and market creation).
    pub paused: bool,

    /// Maximum age (seconds) an oracle price can be before it is rejected.
    pub staleness_threshold: i64,

    /// Maximum oracle confidence interval in basis points.
    pub confidence_threshold_bps: u64,

    /// PDA bump seed for the config account.
    pub bump: u8,
}

impl MeridianConfig {
    /// Discriminator (8) + Pubkey (32) + bool (1) + i64 (8) + u64 (8) + u8 (1)
    pub const SIZE: usize = 8 + 32 + 1 + 8 + 8 + 1;
}

/// Per-ticker configuration. PDA seeded by `["ticker", symbol_bytes]`.
#[account]
pub struct TickerConfig {
    /// Ticker symbol, e.g. "SPY", "QQQ". Max 10 chars.
    pub symbol: String,

    /// The Pyth price-feed account for this ticker.
    pub pyth_feed_id: Pubkey,

    /// Whether this ticker is currently active for new markets.
    pub active: bool,

    /// PDA bump seed for the ticker account.
    pub bump: u8,
}

impl TickerConfig {
    /// Discriminator (8) + String prefix (4) + max chars (10) + Pubkey (32) + bool (1) + u8 (1)
    pub const SIZE: usize = 8 + 4 + MAX_SYMBOL_LEN + 32 + 1 + 1;
}

/// A binary-option strike market. PDA seeded by
/// `["market", symbol_bytes, strike_price_le, trading_date_le]`.
#[account]
pub struct StrikeMarket {
    /// Ticker symbol this market is for (max 10 chars).
    pub ticker: String,

    /// Strike price in cents (e.g. 58050 = $580.50).
    pub strike_price: u64,

    /// Trading date as Unix timestamp of midnight ET.
    pub trading_date: i64,

    /// SPL token mint for YES outcome tokens (PDA).
    pub yes_mint: Pubkey,

    /// SPL token mint for NO outcome tokens (PDA).
    pub no_mint: Pubkey,

    /// USDC vault holding collateral for minted pairs (PDA ATA).
    pub vault: Pubkey,

    /// Phoenix Legacy market address for this strike.
    pub phoenix_market: Pubkey,

    /// Total number of Yes/No token pairs minted.
    pub total_pairs_minted: u64,

    /// Whether this market has been settled.
    pub settled: bool,

    /// If settled, whether YES wins (price >= strike).
    pub outcome_yes_wins: bool,

    /// The oracle settlement price (in cents).
    pub settlement_price: u64,

    /// PDA bump seed for the market account.
    pub bump: u8,
}

impl StrikeMarket {
    /// Discriminator (8) + String prefix (4) + max chars (10) +
    /// u64 (8) + i64 (8) + Pubkey*4 (128) + u64 (8) +
    /// bool (1) + bool (1) + u64 (8) + u8 (1)
    pub const SIZE: usize = 8 + 4 + MAX_SYMBOL_LEN + 8 + 8 + 128 + 8 + 1 + 1 + 8 + 1;
}
