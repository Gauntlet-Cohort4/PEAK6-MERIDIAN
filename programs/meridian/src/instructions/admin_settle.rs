use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::MeridianError;
use crate::events::MarketSettled;
use crate::state::{MeridianConfig, StrikeMarket};

/// Admin force-settles a market after the 1-hour delay past 4:05 PM ET.
/// Takes the outcome as a parameter (admin decides YES or NO wins).
pub fn handler(
    ctx: Context<AdminSettle>,
    outcome_yes_wins: bool,
    settlement_price: u64,
) -> Result<()> {
    let market = &ctx.accounts.strike_market;
    require!(!market.settled, MeridianError::MarketAlreadySettled);

    let clock = Clock::get()?;

    // Calculate the earliest time admin can settle:
    // trading_date (midnight ET) + market_close_offset + admin_delay
    let earliest_admin_settle = market
        .trading_date
        .checked_add(MARKET_CLOSE_SECONDS_UTC)
        .ok_or(MeridianError::ArithmeticOverflow)?
        .checked_add(ADMIN_SETTLE_DELAY)
        .ok_or(MeridianError::ArithmeticOverflow)?;

    require!(
        clock.unix_timestamp >= earliest_admin_settle,
        MeridianError::AdminSettleTooEarly
    );

    let market_mut = &mut ctx.accounts.strike_market;
    market_mut.settled = true;
    market_mut.outcome_yes_wins = outcome_yes_wins;
    market_mut.settlement_price = settlement_price;
    market_mut.settled_at = clock.unix_timestamp;

    emit!(MarketSettled {
        market: market_mut.key(),
        ticker: market_mut.ticker.clone(),
        strike_price: market_mut.strike_price,
        settlement_price,
        yes_wins: outcome_yes_wins,
        settled_at: clock.unix_timestamp,
    });

    Ok(())
}

/// Accounts required for `admin_settle`.
#[derive(Accounts)]
pub struct AdminSettle<'info> {
    /// The program admin.
    #[account(
        constraint = admin.key() == config.admin @ MeridianError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    /// Global config PDA.
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, MeridianConfig>>,

    /// The strike market to force-settle.
    #[account(
        mut,
        seeds = [
            MARKET_SEED,
            strike_market.ticker.as_bytes(),
            &strike_market.strike_price.to_le_bytes(),
            &strike_market.trading_date.to_le_bytes(),
        ],
        bump = strike_market.bump,
    )]
    pub strike_market: Box<Account<'info, StrikeMarket>>,
}
