use anchor_lang::prelude::*;

#[error_code]
pub enum MeridianError {
    #[msg("Market already settled")]
    MarketAlreadySettled,
    #[msg("Oracle price too stale")]
    OraclePriceStale,
    #[msg("Oracle confidence too wide")]
    OracleConfidenceTooWide,
    #[msg("Market not yet settleable")]
    MarketNotSettleable,
    #[msg("Admin settle too early")]
    AdminSettleTooEarly,
    #[msg("Program is paused")]
    ProgramPaused,
    #[msg("Invalid strike price")]
    InvalidStrikePrice,
    #[msg("Insufficient USDC balance")]
    InsufficientBalance,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Phoenix CPI failed")]
    PhoenixCpiFailed,
    #[msg("OpenBook CPI failed")]
    OpenBookCpiFailed,
    #[msg("Invalid oracle account")]
    InvalidOracleAccount,
    #[msg("Market creation failed")]
    MarketCreationFailed,
    #[msg("Duplicate strike")]
    DuplicateStrike,
}
