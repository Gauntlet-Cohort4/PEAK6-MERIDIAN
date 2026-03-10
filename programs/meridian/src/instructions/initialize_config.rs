use anchor_lang::prelude::*;

use crate::constants::{
    CONFIDENCE_THRESHOLD_BPS, CONFIG_SEED, MAX_SYMBOL_LEN, STALENESS_THRESHOLD, TICKER_SEED,
};
use crate::errors::MeridianError;
use crate::state::{MeridianConfig, TickerConfig};

/// Parameters for a single ticker to register during initialization.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TickerInit {
    pub symbol: String,
    pub pyth_feed_id: Pubkey,
}

/// Creates the global MeridianConfig PDA. One-time call by the deployer.
///
/// After creating the config, the caller should invoke `register_ticker`
/// for each initial ticker (Anchor instructions cannot create a dynamic
/// number of accounts in a single ix).
pub fn handler(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.paused = false;
    config.staleness_threshold = STALENESS_THRESHOLD;
    config.confidence_threshold_bps = CONFIDENCE_THRESHOLD_BPS;
    config.bump = ctx.bumps.config;
    Ok(())
}

/// Accounts required for `initialize_config`.
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    /// The admin who will own the config.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Global config PDA — created once.
    #[account(
        init,
        payer = admin,
        space = MeridianConfig::SIZE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, MeridianConfig>,

    pub system_program: Program<'info, System>,
}

/// Batch-register initial tickers in a separate instruction called
/// immediately after `initialize_config`. Each ticker is a separate
/// `register_ticker` call (Anchor requires fixed account layouts).
///
/// This helper validates ticker init params without creating accounts.
pub fn validate_ticker_init(ticker: &TickerInit) -> Result<()> {
    require!(
        ticker.symbol.len() <= MAX_SYMBOL_LEN,
        MeridianError::SymbolTooLong
    );
    Ok(())
}
