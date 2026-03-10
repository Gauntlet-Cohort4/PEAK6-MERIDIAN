use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::MeridianError;
use crate::events::TokensRedeemed;
use crate::state::StrikeMarket;

/// Redeems tokens after market settlement.
///
/// - Winning tokens: burn and receive 1 USDC each from vault.
/// - Losing tokens: burn with 0 payout.
///
/// The `redeem_yes` flag indicates which token type the user is redeeming.
pub fn handler(ctx: Context<Redeem>, amount: u64, redeem_yes: bool) -> Result<()> {
    require!(amount > 0, MeridianError::ZeroAmount);

    let market = &ctx.accounts.strike_market;
    require!(market.settled, MeridianError::MarketNotSettled);

    let is_winning = if redeem_yes {
        market.outcome_yes_wins
    } else {
        !market.outcome_yes_wins
    };

    // Build signer seeds for the strike market PDA.
    let strike_bytes = market.strike_price.to_le_bytes();
    let date_bytes = market.trading_date.to_le_bytes();
    let bump_bytes = [market.bump];
    let signer_seeds: &[&[u8]] = &[
        MARKET_SEED,
        market.ticker.as_bytes(),
        &strike_bytes,
        &date_bytes,
        &bump_bytes,
    ];

    // Burn the user's tokens.
    let (user_token_account, mint_account) = if redeem_yes {
        (
            ctx.accounts.user_yes.to_account_info(),
            ctx.accounts.yes_mint.to_account_info(),
        )
    } else {
        (
            ctx.accounts.user_no.to_account_info(),
            ctx.accounts.no_mint.to_account_info(),
        )
    };

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: mint_account,
                from: user_token_account,
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // Pay out USDC if winning.
    let payout = if is_winning {
        let payout_amount = amount
            .checked_mul(PAIR_COST_LAMPORTS as u64)
            .ok_or(MeridianError::ArithmeticOverflow)?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_usdc.to_account_info(),
                    authority: ctx.accounts.strike_market.to_account_info(),
                },
                &[signer_seeds],
            ),
            payout_amount,
        )?;
        payout_amount
    } else {
        0
    };

    // Track pair redemptions so the vault invariant holds.
    if is_winning {
        let market_mut = &mut ctx.accounts.strike_market;
        market_mut.total_pairs_redeemed = market_mut
            .total_pairs_redeemed
            .checked_add(amount)
            .ok_or(MeridianError::ArithmeticOverflow)?;
    }

    let token_type = if redeem_yes {
        "YES".to_string()
    } else {
        "NO".to_string()
    };

    emit!(TokensRedeemed {
        market: ctx.accounts.strike_market.key(),
        user: ctx.accounts.user.key(),
        token_type,
        payout,
    });

    Ok(())
}

/// Accounts required for `redeem`.
#[derive(Accounts)]
pub struct Redeem<'info> {
    /// The user redeeming tokens.
    #[account(mut)]
    pub user: Signer<'info>,

    /// The settled strike market (mutable to track redemptions).
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
    pub strike_market: Account<'info, StrikeMarket>,

    /// YES token mint.
    #[account(
        mut,
        seeds = [YES_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Account<'info, Mint>,

    /// NO token mint.
    #[account(
        mut,
        seeds = [NO_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub no_mint: Account<'info, Mint>,

    /// User's YES token account.
    #[account(
        mut,
        token::mint = yes_mint,
        token::authority = user,
    )]
    pub user_yes: Account<'info, TokenAccount>,

    /// User's NO token account.
    #[account(
        mut,
        token::mint = no_mint,
        token::authority = user,
    )]
    pub user_no: Account<'info, TokenAccount>,

    /// User's USDC token account (for payout). Must match vault mint.
    #[account(
        mut,
        constraint = user_usdc.mint == vault.mint @ MeridianError::InvalidTokenAccount,
    )]
    pub user_usdc: Account<'info, TokenAccount>,

    /// Market's USDC vault.
    #[account(
        mut,
        seeds = [VAULT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
