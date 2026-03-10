use anchor_lang::prelude::*;

/// Side of a trade on the order book.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderSide {
    Bid,
    Ask,
}

/// Type of order to place on the order book.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderType {
    /// Immediate-or-cancel: fill what you can, cancel the rest.
    Market,
    /// Post a resting limit order.
    Limit,
}

/// Parameters for placing an order on a DEX order book.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OrderParams {
    /// Side: bid or ask.
    pub side: OrderSide,
    /// Order type: market (IOC) or limit.
    pub order_type: OrderType,
    /// Price in the DEX's native tick format (0 for market orders).
    pub price_in_ticks: u64,
    /// Size in base lots.
    pub size_in_base_lots: u64,
}

/// Trait abstracting DEX order book interactions.
///
/// Each adapter (Phoenix, OpenBook, etc.) implements this trait to
/// provide a uniform interface for composite instructions.
pub trait OrderBookAdapter<'info> {
    /// Places an order on the DEX.
    ///
    /// For market orders, `params.price_in_ticks` is ignored (IOC at best available).
    /// For limit orders, the order is posted at the specified price.
    fn place_order(
        &self,
        params: &OrderParams,
        signer_seeds: &[&[u8]],
    ) -> Result<()>;

    /// Cancels all resting orders for the authority on this market.
    fn cancel_all_orders(
        &self,
        signer_seeds: &[&[u8]],
    ) -> Result<()>;
}
