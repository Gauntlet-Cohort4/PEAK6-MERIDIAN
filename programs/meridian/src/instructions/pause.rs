use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::errors::MeridianError;
use crate::state::MeridianConfig;

/// Pauses the program. Blocks: mint_pair, create_strike_market, add_strike.
/// Does NOT block: settle_market, admin_settle, redeem.
pub fn handler(ctx: Context<Pause>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.paused = true;
    Ok(())
}

/// Accounts required for `pause`.
#[derive(Accounts)]
pub struct Pause<'info> {
    /// The program admin.
    #[account(
        constraint = admin.key() == config.admin @ MeridianError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    /// Global config PDA (mutable to set paused flag).
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MeridianConfig>,
}
