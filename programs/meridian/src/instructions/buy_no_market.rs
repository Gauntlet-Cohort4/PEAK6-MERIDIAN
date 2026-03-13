use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::adapters::orderbook::{OrderBookAdapter, OrderParams, OrderSide, OrderType};
use crate::adapters::phoenix::PhoenixLegacyAdapter;
use crate::constants::*;
use crate::errors::MeridianError;
use crate::events::PairMinted;
use crate::state::{MeridianConfig, StrikeMarket};

/// Composite instruction: mint a Yes/No pair, then sell Yes at market (IOC)
/// via Phoenix Legacy. User ends up holding only No tokens.
///
/// Steps:
///   1. Transfer USDC from user to vault
///   2. Mint Yes + No tokens to the market PDA's token accounts
///   3. CPI to Phoenix: sell Yes tokens at market (IOC)
///   4. Transfer No tokens from PDA to user
pub fn handler(ctx: Context<BuyNoMarket>, amount: u64) -> Result<()> {
    require!(amount > 0, MeridianError::ZeroAmount);

    let config = &ctx.accounts.config;
    require!(!config.paused, MeridianError::ProgramPaused);

    let market = &ctx.accounts.strike_market;
    require!(!market.settled, MeridianError::MarketAlreadySettled);

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

    let usdc_amount = amount
        .checked_mul(PAIR_COST_LAMPORTS as u64)
        .ok_or(MeridianError::ArithmeticOverflow)?;

    // 1. Transfer USDC from user to vault.
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

    // 2. Mint Yes tokens to PDA's yes account (for selling on Phoenix).
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.yes_mint.to_account_info(),
                to: ctx.accounts.pda_yes_account.to_account_info(),
                authority: ctx.accounts.strike_market.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    // Mint No tokens directly to user.
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

    // 3. CPI to Phoenix: sell Yes tokens at market (IOC).
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
        side: OrderSide::Ask,
        order_type: OrderType::Market,
        price_in_ticks: 0,
        size_in_base_lots: amount,
    };

    phoenix_adapter.place_order(&order_params, signer_seeds)?;

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

/// Accounts required for `buy_no_market`.
#[derive(Accounts)]
pub struct BuyNoMarket<'info> {
    /// The user buying No tokens.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Global config (for pause check).
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, MeridianConfig>>,

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

    /// YES token mint.
    #[account(
        mut,
        seeds = [YES_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Box<Account<'info, Mint>>,

    /// NO token mint.
    #[account(
        mut,
        seeds = [NO_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub no_mint: Box<Account<'info, Mint>>,

    /// User's USDC token account.
    #[account(mut)]
    pub user_usdc: Box<Account<'info, TokenAccount>>,

    /// User's NO token account.
    #[account(mut)]
    pub user_no: Box<Account<'info, TokenAccount>>,

    /// PDA-owned YES token account (for Phoenix selling).
    #[account(
        mut,
        token::mint = yes_mint,
        token::authority = strike_market,
    )]
    pub pda_yes_account: Box<Account<'info, TokenAccount>>,

    /// PDA-owned quote token account (receives USDC from Phoenix trade).
    #[account(
        mut,
        token::authority = strike_market,
    )]
    pub pda_quote_account: Box<Account<'info, TokenAccount>>,

    /// Market's USDC vault.
    #[account(
        mut,
        seeds = [VAULT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// Phoenix Legacy program.
    /// CHECK: Validated in adapter by comparing against known program ID.
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
