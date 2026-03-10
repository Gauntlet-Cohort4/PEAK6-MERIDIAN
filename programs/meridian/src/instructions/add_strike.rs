use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::MeridianError;
use crate::events::MarketCreated;
use crate::state::{MeridianConfig, StrikeMarket, TickerConfig};

/// Adds a new strike market intraday. Functionally identical to
/// `create_strike_market` but semantically represents an intraday addition.
pub fn handler(
    ctx: Context<AddStrike>,
    strike_price: u64,
    trading_date: i64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, MeridianError::ProgramPaused);
    require!(strike_price > 0, MeridianError::InvalidStrikePrice);

    let ticker_config = &ctx.accounts.ticker_config;
    require!(ticker_config.active, MeridianError::TickerNotActive);

    let market = &mut ctx.accounts.strike_market;
    market.ticker = ticker_config.symbol.clone();
    market.strike_price = strike_price;
    market.trading_date = trading_date;
    market.yes_mint = ctx.accounts.yes_mint.key();
    market.no_mint = ctx.accounts.no_mint.key();
    market.vault = ctx.accounts.vault.key();
    market.phoenix_market = ctx.accounts.phoenix_market.key();
    market.total_pairs_minted = 0;
    market.settled = false;
    market.outcome_yes_wins = false;
    market.settlement_price = 0;
    market.bump = ctx.bumps.strike_market;

    emit!(MarketCreated {
        market: market.key(),
        ticker: market.ticker.clone(),
        strike_price,
        trading_date,
    });

    Ok(())
}

/// Accounts required for `add_strike`.
#[derive(Accounts)]
#[instruction(strike_price: u64, trading_date: i64)]
pub struct AddStrike<'info> {
    /// The program admin.
    #[account(
        mut,
        constraint = admin.key() == config.admin @ MeridianError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    /// Global config PDA.
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MeridianConfig>,

    /// The ticker this strike belongs to.
    #[account(
        seeds = [TICKER_SEED, ticker_config.symbol.as_bytes()],
        bump = ticker_config.bump,
    )]
    pub ticker_config: Account<'info, TickerConfig>,

    /// The new strike market PDA.
    #[account(
        init,
        payer = admin,
        space = StrikeMarket::SIZE,
        seeds = [
            MARKET_SEED,
            ticker_config.symbol.as_bytes(),
            &strike_price.to_le_bytes(),
            &trading_date.to_le_bytes(),
        ],
        bump,
    )]
    pub strike_market: Account<'info, StrikeMarket>,

    /// YES outcome token mint (PDA).
    #[account(
        init,
        payer = admin,
        mint::decimals = OUTCOME_TOKEN_DECIMALS,
        mint::authority = strike_market,
        seeds = [YES_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Account<'info, Mint>,

    /// NO outcome token mint (PDA).
    #[account(
        init,
        payer = admin,
        mint::decimals = OUTCOME_TOKEN_DECIMALS,
        mint::authority = strike_market,
        seeds = [NO_MINT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub no_mint: Account<'info, Mint>,

    /// USDC token mint (external).
    pub usdc_mint: Account<'info, Mint>,

    /// USDC vault for this market.
    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = strike_market,
        seeds = [VAULT_SEED, strike_market.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Phoenix Legacy market (created off-chain).
    /// CHECK: Validated off-chain; stored as reference only.
    pub phoenix_market: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
