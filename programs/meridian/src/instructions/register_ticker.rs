use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, MAX_SYMBOL_LEN, TICKER_SEED};
use crate::errors::MeridianError;
use crate::state::{MeridianConfig, TickerConfig};

/// Registers a new ticker with its Pyth price-feed ID.
/// Only the admin can call this.
pub fn handler(
    ctx: Context<RegisterTicker>,
    symbol: String,
    pyth_feed_id: Pubkey,
) -> Result<()> {
    require!(symbol.len() <= MAX_SYMBOL_LEN, MeridianError::SymbolTooLong);

    let ticker = &mut ctx.accounts.ticker_config;
    ticker.symbol = symbol;
    ticker.pyth_feed_id = pyth_feed_id;
    ticker.active = true;
    ticker.bump = ctx.bumps.ticker_config;
    Ok(())
}

/// Accounts required for `register_ticker`.
#[derive(Accounts)]
#[instruction(symbol: String)]
pub struct RegisterTicker<'info> {
    /// The program admin.
    #[account(
        mut,
        constraint = admin.key() == config.admin @ MeridianError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    /// Global config (read-only for admin check).
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MeridianConfig>,

    /// Ticker config PDA — created here.
    #[account(
        init,
        payer = admin,
        space = TickerConfig::SIZE,
        seeds = [TICKER_SEED, symbol.as_bytes()],
        bump,
    )]
    pub ticker_config: Account<'info, TickerConfig>,

    pub system_program: Program<'info, System>,
}
