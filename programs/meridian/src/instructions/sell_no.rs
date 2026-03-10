use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::adapters::orderbook::{OrderParams, OrderSide, OrderType};
use crate::adapters::phoenix::PhoenixLegacyAdapter;
use crate::constants::*;
use crate::errors::MeridianError;
use crate::state::{MeridianConfig, StrikeMarket};

/// Composite instruction: buy Yes on Phoenix at market, then redeem
/// the Yes + No pair for 1 USDC.
///
/// Steps:
///   1. CPI to Phoenix: buy Yes tokens at market (IOC)
///   2. Burn 1 Yes + 1 No token per unit
///   3. Transfer 1 USDC per unit from vault to user
pub fn handler(ctx: Context<SellNo>, amount: u64) -> Result<()> {
    require!(amount > 0, MeridianError::ZeroAmount);

    let config = &ctx.accounts.config;
    require!(!config.paused, MeridianError::ProgramPaused);

    let market = &ctx.accounts.strike_market;
    require!(!market.settled, MeridianError::MarketAlreadySettled);

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

    // 1. CPI to Phoenix: buy Yes tokens at market (IOC).
    let phoenix_adapter = PhoenixLegacyAdapter {
        phoenix_program: &ctx.accounts.phoenix_program,
        phoenix_market: &ctx.accounts.phoenix_market,
        trader: &ctx.accounts.strike_market.to_account_info(),
        base_account: &ctx.accounts.pda_yes_account.to_account_info(),
        quote_account: &ctx.accounts.pda_quote_account.to_account_info(),
        base_vault: &ctx.accounts.phoenix_base_vault,
        quote_vault: &ctx.accounts.phoenix_quote_vault,
        token_program: &ctx.accounts.token_program.to_account_info(),
    };

    let order_params = OrderParams {
        side: OrderSide::Bid,
        order_type: OrderType::Market,
        price_in_ticks: 0,
        size_in_base_lots: amount,
    };

    phoenix_adapter.place_order(&order_params, signer_seeds)?;

    // 2. Burn Yes tokens (acquired from Phoenix) from PDA account.
    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.yes_mint.to_account_info(),
                from: ctx.accounts.pda_yes_account.to_account_info(),
                authority: ctx.accounts.strike_market.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    // Burn No tokens from user's account.
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.no_mint.to_account_info(),
                from: ctx.accounts.user_no.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // 3. Transfer USDC from vault to user.
    let usdc_amount = amount
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
        usdc_amount,
    )?;

    // Track pair redemptions so the vault invariant holds:
    // vault_balance = (total_pairs_minted - total_pairs_redeemed) * PAIR_COST_LAMPORTS
    let market_mut = &mut ctx.accounts.strike_market;
    market_mut.total_pairs_redeemed = market_mut
        .total_pairs_redeemed
        .checked_add(amount)
        .ok_or(MeridianError::ArithmeticOverflow)?;

    Ok(())
}

/// Accounts required for `sell_no`.
#[derive(Accounts)]
pub struct SellNo<'info> {
    /// The user selling No tokens.
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

    /// User's USDC token account.
    #[account(mut)]
    pub user_usdc: Account<'info, TokenAccount>,

    /// User's NO token account.
    #[account(mut)]
    pub user_no: Account<'info, TokenAccount>,

    /// PDA-owned YES token account (receives Yes from Phoenix).
    #[account(mut)]
    pub pda_yes_account: Account<'info, TokenAccount>,

    /// PDA-owned quote token account (sends quote to Phoenix).
    #[account(mut)]
    pub pda_quote_account: Account<'info, TokenAccount>,

    /// Market's USDC vault.
    #[account(
        mut,
        seeds = [VAULT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Phoenix Legacy program.
    /// CHECK: Validated in adapter.
    pub phoenix_program: AccountInfo<'info>,

    /// Phoenix market account.
    /// CHECK: Must match strike_market.phoenix_market.
    #[account(
        mut,
        constraint = phoenix_market.key() == strike_market.phoenix_market
            @ MeridianError::PhoenixCpiFailed,
    )]
    pub phoenix_market: AccountInfo<'info>,

    /// Phoenix base vault.
    /// CHECK: Validated by Phoenix program during CPI.
    #[account(mut)]
    pub phoenix_base_vault: AccountInfo<'info>,

    /// Phoenix quote vault.
    /// CHECK: Validated by Phoenix program during CPI.
    #[account(mut)]
    pub phoenix_quote_vault: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}
