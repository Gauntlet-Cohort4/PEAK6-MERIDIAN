use anchor_lang::prelude::*;

/// Comprehensive error codes for the Meridian prediction market program.
#[error_code]
pub enum MeridianError {
    /// Market has already been settled and cannot be settled again.
    #[msg("Market already settled")]
    MarketAlreadySettled,

    /// Oracle price timestamp exceeds the staleness threshold.
    #[msg("Oracle price too stale")]
    OraclePriceStale,

    /// Oracle confidence interval exceeds the allowed basis-point threshold.
    #[msg("Oracle confidence too wide")]
    OracleConfidenceTooWide,

    /// Market settlement conditions have not been met yet.
    #[msg("Market not yet settleable")]
    MarketNotSettleable,

    /// Admin tried to force-settle before the required delay elapsed.
    #[msg("Admin settle too early")]
    AdminSettleTooEarly,

    /// The program is currently paused; this operation is blocked.
    #[msg("Program is paused")]
    ProgramPaused,

    /// The provided strike price is invalid (zero or unreasonable).
    #[msg("Invalid strike price")]
    InvalidStrikePrice,

    /// User does not have enough USDC to complete the operation.
    #[msg("Insufficient USDC balance")]
    InsufficientBalance,

    /// The token account provided does not match the expected mint.
    #[msg("Invalid token account")]
    InvalidTokenAccount,

    /// Caller is not the program admin.
    #[msg("Unauthorized")]
    Unauthorized,

    /// A CPI call to the Phoenix Legacy program failed.
    #[msg("Phoenix CPI failed")]
    PhoenixCpiFailed,

    /// A CPI call to the OpenBook program failed.
    #[msg("OpenBook CPI failed")]
    OpenBookCpiFailed,

    /// The oracle account provided is not valid for this ticker.
    #[msg("Invalid oracle account")]
    InvalidOracleAccount,

    /// An error occurred while creating the market.
    #[msg("Market creation failed")]
    MarketCreationFailed,

    /// A strike market with this configuration already exists.
    #[msg("Duplicate strike")]
    DuplicateStrike,

    /// The ticker symbol exceeds the maximum allowed length.
    #[msg("Symbol too long")]
    SymbolTooLong,

    /// The ticker is not registered or is inactive.
    #[msg("Ticker not active")]
    TickerNotActive,

    /// The market has not been settled yet.
    #[msg("Market not settled")]
    MarketNotSettled,

    /// Arithmetic overflow during calculation.
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    /// The provided amount must be greater than zero.
    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    /// The provided trading date is in the past.
    #[msg("Trading date in the past")]
    TradingDatePast,

    /// The program is not paused (relevant for unpause).
    #[msg("Program not paused")]
    ProgramNotPaused,
}
