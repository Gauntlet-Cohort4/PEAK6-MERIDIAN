use anchor_lang::prelude::*;

pub mod adapters;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE");

#[program]
pub mod meridian {
    use super::*;

    /// Initializes the global program configuration. One-time call.
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::initialize_config::handler(ctx)
    }

    /// Registers a new ticker with its Pyth price-feed ID.
    pub fn register_ticker(
        ctx: Context<RegisterTicker>,
        symbol: String,
        pyth_feed_id: Pubkey,
    ) -> Result<()> {
        instructions::register_ticker::handler(ctx, symbol, pyth_feed_id)
    }

    /// Creates a new strike market with Yes/No mints and USDC vault.
    pub fn create_strike_market(
        ctx: Context<CreateStrikeMarket>,
        strike_price: u64,
        trading_date: i64,
    ) -> Result<()> {
        instructions::create_strike_market::handler(ctx, strike_price, trading_date)
    }

    /// Adds a new strike market intraday.
    pub fn add_strike(
        ctx: Context<AddStrike>,
        strike_price: u64,
        trading_date: i64,
    ) -> Result<()> {
        instructions::add_strike::handler(ctx, strike_price, trading_date)
    }

    /// Mints Yes/No token pairs by depositing USDC.
    pub fn mint_pair(ctx: Context<MintPair>, amount: u64) -> Result<()> {
        instructions::mint_pair::handler(ctx, amount)
    }

    /// Settles a market using the Pyth oracle price.
    pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
        instructions::settle_market::handler(ctx)
    }

    /// Admin force-settles a market after the required delay.
    pub fn admin_settle(
        ctx: Context<AdminSettle>,
        outcome_yes_wins: bool,
        settlement_price: u64,
    ) -> Result<()> {
        instructions::admin_settle::handler(ctx, outcome_yes_wins, settlement_price)
    }

    /// Redeems tokens after market settlement.
    pub fn redeem(
        ctx: Context<Redeem>,
        amount: u64,
        redeem_yes: bool,
    ) -> Result<()> {
        instructions::redeem::handler(ctx, amount, redeem_yes)
    }

    /// Composite: mint pair + sell Yes at market on Phoenix. User gets No.
    pub fn buy_no_market(ctx: Context<BuyNoMarket>, amount: u64) -> Result<()> {
        instructions::buy_no_market::handler(ctx, amount)
    }

    /// Composite: mint pair + post Yes as limit sell on Phoenix.
    pub fn buy_no_limit(
        ctx: Context<BuyNoLimit>,
        amount: u64,
        price_in_ticks: u64,
    ) -> Result<()> {
        instructions::buy_no_limit::handler(ctx, amount, price_in_ticks)
    }

    /// Composite: buy Yes on Phoenix + redeem Yes+No pair for USDC.
    pub fn sell_no(ctx: Context<SellNo>, amount: u64) -> Result<()> {
        instructions::sell_no::handler(ctx, amount)
    }

    /// Updates the Phoenix market address on a strike market (admin only).
    pub fn set_phoenix_market(
        ctx: Context<SetPhoenixMarket>,
        phoenix_market: Pubkey,
    ) -> Result<()> {
        instructions::set_phoenix_market::handler(ctx, phoenix_market)
    }

    /// Pauses the program (blocks minting and market creation).
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::handler(ctx)
    }

    /// Unpauses the program.
    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        instructions::unpause::handler(ctx)
    }
}
