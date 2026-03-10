use anchor_lang::prelude::*;

/// Emitted when a user mints a Yes/No token pair.
#[event]
pub struct PairMinted {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

/// Emitted when a market is settled (either by oracle or admin).
#[event]
pub struct MarketSettled {
    pub market: Pubkey,
    pub ticker: String,
    pub strike_price: u64,
    pub settlement_price: u64,
    pub yes_wins: bool,
}

/// Emitted when a user redeems tokens after settlement.
#[event]
pub struct TokensRedeemed {
    pub market: Pubkey,
    pub user: Pubkey,
    /// "YES" or "NO"
    pub token_type: String,
    pub payout: u64,
}

/// Emitted when a new strike market is created.
#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub ticker: String,
    pub strike_price: u64,
    pub trading_date: i64,
}
