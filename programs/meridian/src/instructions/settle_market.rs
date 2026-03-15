use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::MeridianError;
use crate::events::MarketSettled;
use crate::state::{MeridianConfig, StrikeMarket, TickerConfig};

/// Settles a market using the Pyth oracle price.
///
/// Validates that the market close time has passed, then reads the Pyth v2
/// price account to check staleness and confidence. Determines whether
/// YES wins (price >= strike) or NO wins (price < strike).
pub fn handler(ctx: Context<SettleMarket>) -> Result<()> {
    let market = &ctx.accounts.strike_market;
    require!(!market.settled, MeridianError::MarketAlreadySettled);

    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    // Ensure market close time has passed before allowing settlement.
    let market_close_time = market
        .trading_date
        .checked_add(MARKET_CLOSE_SECONDS_UTC)
        .ok_or(MeridianError::ArithmeticOverflow)?;
    require!(
        clock.unix_timestamp >= market_close_time,
        MeridianError::MarketNotSettleable
    );

    // Read price data from the Pyth price account.
    // The Pyth account is passed as an UncheckedAccount and we parse it manually.
    let pyth_account = &ctx.accounts.pyth_price_account;
    let pyth_data = pyth_account.try_borrow_data()?;

    // Parse Pyth v2 price account layout:
    //   offset 0..4:     magic number (u32 LE, must be 0xa1b2c3d4)
    //   offset 208..216: price (i64 LE)
    //   offset 216..224: conf (u64 LE)
    //   offset 224..228: expo (i32 LE)
    //   offset 228..232: (padding)
    //   offset 232..240: publish_time (i64 LE)
    //
    // We validate minimum data length, magic number, and parse key fields.
    require!(pyth_data.len() >= 240, MeridianError::InvalidOracleAccount);

    // Validate Pyth v2 magic number (0xa1b2c3d4).
    let magic = u32::from_le_bytes(
        pyth_data[0..4]
            .try_into()
            .map_err(|_| MeridianError::InvalidOracleAccount)?,
    );
    require!(magic == 0xa1b2_c3d4, MeridianError::InvalidOracleAccount);

    let price = i64::from_le_bytes(
        pyth_data[208..216]
            .try_into()
            .map_err(|_| MeridianError::InvalidOracleAccount)?,
    );

    // Price must be positive before any arithmetic (prevents i64→u64 wrapping).
    require!(price > 0, MeridianError::InvalidOracleAccount);

    let conf = u64::from_le_bytes(
        pyth_data[216..224]
            .try_into()
            .map_err(|_| MeridianError::InvalidOracleAccount)?,
    );
    let expo = i32::from_le_bytes(
        pyth_data[224..228]
            .try_into()
            .map_err(|_| MeridianError::InvalidOracleAccount)?,
    );
    let publish_time = i64::from_le_bytes(
        pyth_data[232..240]
            .try_into()
            .map_err(|_| MeridianError::InvalidOracleAccount)?,
    );

    // Staleness check.
    let age = clock
        .unix_timestamp
        .checked_sub(publish_time)
        .ok_or(MeridianError::ArithmeticOverflow)?;
    require!(
        age <= config.staleness_threshold,
        MeridianError::OraclePriceStale
    );

    // Confidence check (conf / price in BPS).
    // Safe to cast: price is guaranteed positive above.
    let conf_bps = conf
        .checked_mul(10_000)
        .ok_or(MeridianError::ArithmeticOverflow)?
        .checked_div(price as u64)
        .ok_or(MeridianError::ArithmeticOverflow)?;
    require!(
        conf_bps <= config.confidence_threshold_bps,
        MeridianError::OracleConfidenceTooWide
    );

    // Convert oracle price to cents for comparison with strike_price.
    // price * 10^(expo + 2) gives cents. We handle negative exponents.
    let settlement_price_cents = convert_to_cents(price, expo)?;

    let yes_wins = settlement_price_cents >= market.strike_price;

    // Update market state.
    let market_mut = &mut ctx.accounts.strike_market;
    market_mut.settled = true;
    market_mut.outcome_yes_wins = yes_wins;
    market_mut.settlement_price = settlement_price_cents;

    emit!(MarketSettled {
        market: market_mut.key(),
        ticker: market_mut.ticker.clone(),
        strike_price: market_mut.strike_price,
        settlement_price: settlement_price_cents,
        yes_wins,
    });

    Ok(())
}

/// Converts a Pyth price (with exponent) to cents (hundredths of a dollar).
///
/// For example: price=58050, expo=-2 means $580.50 = 58050 cents.
/// price=5805000, expo=-4 means $580.5000 => 58050 cents.
fn convert_to_cents(price: i64, expo: i32) -> Result<u64> {
    // Target: price * 10^(expo + 2)
    let adjusted_expo = expo
        .checked_add(2)
        .ok_or(MeridianError::ArithmeticOverflow)?;

    let price_u64 = price as u64;

    if adjusted_expo >= 0 {
        let multiplier = 10u64
            .checked_pow(adjusted_expo as u32)
            .ok_or(MeridianError::ArithmeticOverflow)?;
        price_u64
            .checked_mul(multiplier)
            .ok_or(MeridianError::ArithmeticOverflow.into())
    } else {
        let divisor = 10u64
            .checked_pow((-adjusted_expo) as u32)
            .ok_or(MeridianError::ArithmeticOverflow)?;
        price_u64
            .checked_div(divisor)
            .ok_or(MeridianError::ArithmeticOverflow.into())
    }
}

/// Accounts required for `settle_market`.
#[derive(Accounts)]
pub struct SettleMarket<'info> {
    /// Anyone can call settle (permissionless cranking).
    pub settler: Signer<'info>,

    /// Global config (for threshold values).
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, MeridianConfig>>,

    /// The ticker config (to validate pyth feed).
    #[account(
        seeds = [TICKER_SEED, ticker_config.symbol.as_bytes()],
        bump = ticker_config.bump,
    )]
    pub ticker_config: Box<Account<'info, TickerConfig>>,

    /// The strike market to settle.
    #[account(
        mut,
        seeds = [
            MARKET_SEED,
            strike_market.ticker.as_bytes(),
            &strike_market.strike_price.to_le_bytes(),
            &strike_market.trading_date.to_le_bytes(),
        ],
        bump = strike_market.bump,
        constraint = strike_market.ticker == ticker_config.symbol,
    )]
    pub strike_market: Box<Account<'info, StrikeMarket>>,

    /// Pyth price account for the ticker.
    /// CHECK: Validated by comparing against ticker_config.pyth_feed_id.
    #[account(
        constraint = pyth_price_account.key() == ticker_config.pyth_feed_id
            @ MeridianError::InvalidOracleAccount,
    )]
    pub pyth_price_account: UncheckedAccount<'info>,
}
