use anchor_lang::prelude::*;

use super::orderbook::{OrderBookAdapter, OrderParams};
use crate::errors::MeridianError;

/// Stub adapter for the OpenBook DEX.
///
/// TODO: Implement CPI calls to OpenBook V2 when integration is required.
/// This follows the same `OrderBookAdapter` trait as the Phoenix adapter
/// so it can be swapped in as an alternative venue.
pub struct OpenBookAdapter<'a, 'info> {
    /// The OpenBook program account.
    pub openbook_program: &'a AccountInfo<'info>,
    /// The OpenBook market account.
    pub openbook_market: &'a AccountInfo<'info>,
    /// The trader (authority) account.
    pub trader: &'a AccountInfo<'info>,
}

impl<'a, 'info> OrderBookAdapter<'info> for OpenBookAdapter<'a, 'info> {
    /// Stub: places an order on the OpenBook DEX.
    ///
    /// TODO: Implement the actual CPI call to OpenBook V2.
    /// Required steps:
    ///   1. Build instruction data matching OpenBook's `place_order` layout
    ///   2. Assemble the correct account metas (market, open_orders, etc.)
    ///   3. Use `invoke_signed` with the PDA signer seeds
    fn place_order(
        &self,
        _params: &OrderParams,
        _signer_seeds: &[&[u8]],
    ) -> Result<()> {
        Err(error!(MeridianError::OpenBookCpiFailed))
    }

    /// Stub: cancels all orders on the OpenBook DEX.
    ///
    /// TODO: Implement the actual CPI call to OpenBook V2.
    fn cancel_all_orders(
        &self,
        _signer_seeds: &[&[u8]],
    ) -> Result<()> {
        Err(error!(MeridianError::OpenBookCpiFailed))
    }
}
