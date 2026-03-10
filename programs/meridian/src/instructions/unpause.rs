use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::errors::MeridianError;
use crate::state::MeridianConfig;

/// Unpauses the program, re-enabling minting and market creation.
pub fn handler(ctx: Context<Unpause>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(config.paused, MeridianError::ProgramNotPaused);
    config.paused = false;
    Ok(())
}

/// Accounts required for `unpause`.
#[derive(Accounts)]
pub struct Unpause<'info> {
    /// The program admin.
    #[account(
        constraint = admin.key() == config.admin @ MeridianError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    /// Global config PDA (mutable to clear paused flag).
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MeridianConfig>,
}
