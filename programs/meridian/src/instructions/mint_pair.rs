use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::MeridianError;
use crate::events::PairMinted;
use crate::state::{MeridianConfig, StrikeMarket};

/// Mints one Yes + one No token pair per USDC deposited.
///
/// `amount` is the number of **pairs** to mint, NOT the USDC amount.
/// Each pair costs 1 USDC (1_000_000 base units / PAIR_COST_LAMPORTS).
/// The user deposits `amount * PAIR_COST_LAMPORTS` USDC and receives
/// `amount` YES tokens + `amount` NO tokens.
pub fn handler(ctx: Context<MintPair>, amount: u64) -> Result<()> {
    require!(amount > 0, MeridianError::ZeroAmount);

    let config = &ctx.accounts.config;
    require!(!config.paused, MeridianError::ProgramPaused);

    let market = &ctx.accounts.strike_market;
    require!(!market.settled, MeridianError::MarketAlreadySettled);

    // Transfer USDC from user to vault.
    let usdc_amount = amount
        .checked_mul(PAIR_COST_LAMPORTS as u64)
        .ok_or(MeridianError::ArithmeticOverflow)?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_usdc.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        usdc_amount,
    )?;

    // Build signer seeds for the strike market PDA.
    let market_ref = &ctx.accounts.strike_market;
    let strike_bytes = market_ref.strike_price.to_le_bytes();
    let date_bytes = market_ref.trading_date.to_le_bytes();
    let bump_bytes = [market_ref.bump];
    let signer_seeds: &[&[u8]] = &[
        MARKET_SEED,
        market_ref.ticker.as_bytes(),
        &strike_bytes,
        &date_bytes,
        &bump_bytes,
    ];

    // Mint YES tokens to user.
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.yes_mint.to_account_info(),
                to: ctx.accounts.user_yes.to_account_info(),
                authority: ctx.accounts.strike_market.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    // Mint NO tokens to user.
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.no_mint.to_account_info(),
                to: ctx.accounts.user_no.to_account_info(),
                authority: ctx.accounts.strike_market.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    // Update state.
    let market_mut = &mut ctx.accounts.strike_market;
    market_mut.total_pairs_minted = market_mut
        .total_pairs_minted
        .checked_add(amount)
        .ok_or(MeridianError::ArithmeticOverflow)?;

    emit!(PairMinted {
        market: market_mut.key(),
        user: ctx.accounts.user.key(),
        amount,
    });

    Ok(())
}

/// Accounts required for `mint_pair`.
#[derive(Accounts)]
pub struct MintPair<'info> {
    /// The user minting token pairs.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Global config (for pause check).
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MeridianConfig>,

    /// The strike market.
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

    /// YES token mint (authority = strike_market PDA).
    #[account(
        mut,
        seeds = [YES_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Box<Account<'info, Mint>>,

    /// NO token mint (authority = strike_market PDA).
    #[account(
        mut,
        seeds = [NO_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub no_mint: Box<Account<'info, Mint>>,

    /// User's USDC token account.
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = user,
    )]
    pub user_usdc: Box<Account<'info, TokenAccount>>,

    /// User's YES token account.
    #[account(
        mut,
        token::mint = yes_mint,
        token::authority = user,
    )]
    pub user_yes: Box<Account<'info, TokenAccount>>,

    /// User's NO token account.
    #[account(
        mut,
        token::mint = no_mint,
        token::authority = user,
    )]
    pub user_no: Box<Account<'info, TokenAccount>>,

    /// USDC mint (external).
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// Market's USDC vault.
    #[account(
        mut,
        seeds = [VAULT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}
