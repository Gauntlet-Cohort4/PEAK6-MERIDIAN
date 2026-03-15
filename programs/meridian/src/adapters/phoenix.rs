use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};

use super::orderbook::{OrderBookAdapter, OrderParams, OrderSide, OrderType};
use crate::errors::MeridianError;

/// Phoenix Legacy program ID, parsed at compile time.
const PHOENIX_PROGRAM_ID: Pubkey = pubkey!("PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY");

/// Phoenix Legacy (V1) instruction discriminators.
///
/// Phoenix V1 uses borsh-serialized enum variants, where the discriminator
/// is a single byte representing the enum variant index of `PhoenixInstruction`.
///
/// Variant indices:
///   0: InitializeMarket
///   1: PlaceLimitOrder
///   2: ReduceOrder
///   3: CancelAllOrders
///   4: CancelUpTo
///   5: CancelMultipleOrders
///   6: PlaceMultiplePostOnlyOrders
///   7: Swap (IOC market order)
///   8: SwapWithFreeFunds
///   9: PlaceLimitOrderWithFreeFunds
///  10: ReduceOrderWithFreeFunds
mod discriminators {
    /// `PlaceLimitOrder` instruction discriminator (variant index 1).
    pub const PLACE_LIMIT_ORDER: u8 = 1;
    /// `Swap` (IOC market order) instruction discriminator (variant index 7).
    pub const SWAP: u8 = 7;
    /// `CancelAllOrders` instruction discriminator (variant index 3).
    pub const CANCEL_ALL_ORDERS: u8 = 3;
}

/// Phoenix order-type raw values for the instruction data.
mod phoenix_order_type {
    pub const LIMIT: u8 = 0;
    pub const IOC: u8 = 1;
    pub const POST_ONLY: u8 = 2;
}

/// Phoenix side raw values.
mod phoenix_side {
    pub const BID: u8 = 0;
    pub const ASK: u8 = 1;
}

/// Adapter for CPI calls to the Phoenix Legacy DEX.
///
/// Holds references to all accounts needed for Phoenix CPI.
/// The actual CPI is performed via `invoke_signed` with manually
/// constructed instruction data.
pub struct PhoenixLegacyAdapter<'a, 'info> {
    /// The Phoenix program account.
    pub phoenix_program: &'a AccountInfo<'info>,
    /// The Phoenix market account.
    pub phoenix_market: &'a AccountInfo<'info>,
    /// The trader (authority) account — typically the strike market PDA.
    pub trader: &'a AccountInfo<'info>,
    /// The trader's base-token account (YES tokens).
    pub base_account: &'a AccountInfo<'info>,
    /// The trader's quote-token account (USDC or NO tokens).
    pub quote_account: &'a AccountInfo<'info>,
    /// The base vault on the Phoenix market.
    pub base_vault: &'a AccountInfo<'info>,
    /// The quote vault on the Phoenix market.
    pub quote_vault: &'a AccountInfo<'info>,
    /// The SPL Token program.
    pub token_program: &'a AccountInfo<'info>,
}

impl<'a, 'info> PhoenixLegacyAdapter<'a, 'info> {
    /// Builds the instruction data for a Phoenix order CPI.
    ///
    /// Phoenix V1 uses borsh-serialized enums. The first byte is the variant
    /// index, followed by variant-specific data.
    ///
    /// For `PlaceLimitOrder` (variant 1):
    ///   [0]      discriminator (1)
    ///   [1..9]   price_in_ticks (u64 LE)
    ///   [9..17]  num_base_lots (u64 LE)
    ///   [17]     order_type (0=Limit, 1=ImmediateOrCancel, 2=PostOnly)
    ///   [18]     side (0=Bid, 1=Ask)
    ///
    /// For `Swap` / IOC market order (variant 7):
    ///   [0]      discriminator (7)
    ///   [1..9]   price_in_ticks (u64 LE)
    ///   [9..17]  num_base_lots (u64 LE)
    ///   [17]     side (0=Bid, 1=Ask)
    fn build_new_order_data(params: &OrderParams) -> Vec<u8> {
        let side_byte = match params.side {
            OrderSide::Bid => phoenix_side::BID,
            OrderSide::Ask => phoenix_side::ASK,
        };

        match params.order_type {
            OrderType::Limit => {
                let mut data = Vec::with_capacity(19);
                data.push(discriminators::PLACE_LIMIT_ORDER);
                data.extend_from_slice(&params.price_in_ticks.to_le_bytes());
                data.extend_from_slice(&params.size_in_base_lots.to_le_bytes());
                data.push(phoenix_order_type::LIMIT);
                data.push(side_byte);
                data
            }
            OrderType::Market => {
                let mut data = Vec::with_capacity(18);
                data.push(discriminators::SWAP);
                data.extend_from_slice(&params.price_in_ticks.to_le_bytes());
                data.extend_from_slice(&params.size_in_base_lots.to_le_bytes());
                data.push(side_byte);
                data
            }
        }
    }

    /// Builds the instruction data for a Phoenix `cancel_all_orders` CPI.
    ///
    /// Phoenix V1 `CancelAllOrders` (variant 3) takes no additional data
    /// beyond the single-byte discriminator.
    fn build_cancel_all_data() -> Vec<u8> {
        vec![discriminators::CANCEL_ALL_ORDERS]
    }

    /// Returns the Phoenix program Pubkey (compile-time constant).
    fn phoenix_program_id() -> Pubkey {
        PHOENIX_PROGRAM_ID
    }
}

impl<'a, 'info> OrderBookAdapter<'info> for PhoenixLegacyAdapter<'a, 'info> {
    /// Places an order on the Phoenix Legacy DEX via CPI.
    fn place_order(
        &self,
        params: &OrderParams,
        signer_seeds: &[&[u8]],
    ) -> Result<()> {
        let program_id = Self::phoenix_program_id();

        // Verify the phoenix program account matches expected ID.
        require!(
            self.phoenix_program.key() == program_id,
            MeridianError::PhoenixCpiFailed
        );

        let ix_data = Self::build_new_order_data(params);

        // Account ordering for Phoenix new_order CPI:
        //   0. phoenix_market (writable)
        //   1. trader (signer)
        //   2. base_account (writable)
        //   3. quote_account (writable)
        //   4. base_vault (writable)
        //   5. quote_vault (writable)
        //   6. token_program
        let accounts = vec![
            AccountMeta::new(self.phoenix_market.key(), false),
            AccountMeta::new_readonly(self.trader.key(), true),
            AccountMeta::new(self.base_account.key(), false),
            AccountMeta::new(self.quote_account.key(), false),
            AccountMeta::new(self.base_vault.key(), false),
            AccountMeta::new(self.quote_vault.key(), false),
            AccountMeta::new_readonly(self.token_program.key(), false),
        ];

        let ix = Instruction {
            program_id,
            accounts,
            data: ix_data,
        };

        invoke_signed(
            &ix,
            &[
                self.phoenix_market.clone(),
                self.trader.clone(),
                self.base_account.clone(),
                self.quote_account.clone(),
                self.base_vault.clone(),
                self.quote_vault.clone(),
                self.token_program.clone(),
            ],
            &[signer_seeds],
        )
        .map_err(|_| error!(MeridianError::PhoenixCpiFailed))
    }

    /// Cancels all resting orders on the Phoenix market.
    fn cancel_all_orders(
        &self,
        signer_seeds: &[&[u8]],
    ) -> Result<()> {
        let program_id = Self::phoenix_program_id();

        let ix_data = Self::build_cancel_all_data();

        let accounts = vec![
            AccountMeta::new(self.phoenix_market.key(), false),
            AccountMeta::new_readonly(self.trader.key(), true),
        ];

        let ix = Instruction {
            program_id,
            accounts,
            data: ix_data,
        };

        invoke_signed(
            &ix,
            &[self.phoenix_market.clone(), self.trader.clone()],
            &[signer_seeds],
        )
        .map_err(|_| error!(MeridianError::PhoenixCpiFailed))
    }
}
