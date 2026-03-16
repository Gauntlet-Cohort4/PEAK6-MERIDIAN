use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::MeridianError;
use crate::state::{MeridianConfig, StrikeMarket};

/// Updates the Phoenix market address on an existing strike market.
/// Required because the YES mint (Phoenix base) must exist before
/// the Phoenix market can be created, but the YES mint is created
/// by `create_strike_market`. Flow:
///   1. create_strike_market (placeholder phoenix address)
///   2. Create Phoenix market off-chain (using YES mint as base)
///   3. set_phoenix_market (store real Phoenix address)
pub fn handler(ctx: Context<SetPhoenixMarket>, phoenix_market: Pubkey) -> Result<()> {
    let market = &mut ctx.accounts.strike_market;
    require!(!market.settled, MeridianError::MarketAlreadySettled);

    market.phoenix_market = phoenix_market;

    Ok(())
}

/// Accounts required for `set_phoenix_market`.
#[derive(Accounts)]
pub struct SetPhoenixMarket<'info> {
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

    /// The strike market to update.
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
