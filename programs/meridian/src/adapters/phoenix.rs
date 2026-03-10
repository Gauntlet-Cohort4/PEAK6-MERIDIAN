use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};

use super::orderbook::{OrderBookAdapter, OrderParams, OrderSide, OrderType};
use crate::errors::MeridianError;

/// Phoenix Legacy program ID.
const PHOENIX_PROGRAM_ID: &str = "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY";

/// Phoenix Legacy instruction discriminators.
/// These are the first 8 bytes of the SHA-256 hash of the instruction name.
///
/// TODO: Verify these discriminators against the actual Phoenix Legacy IDL
/// during Phase 5 integration testing with Surfpool.
mod discriminators {
    /// `new_order` instruction discriminator.
    pub const NEW_ORDER: [u8; 8] = [0x99, 0x1e, 0x56, 0x3b, 0x35, 0x6a, 0x08, 0x01];
    /// `cancel_all_orders` instruction discriminator.
    pub const CANCEL_ALL: [u8; 8] = [0xa4, 0x5d, 0x2e, 0xb4, 0x7c, 0x18, 0x03, 0x02];
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
    /// Builds the instruction data for a Phoenix `new_order` CPI.
    ///
    /// Layout (Phoenix Legacy new_order):
    ///   [0..8]   discriminator
    ///   [8]      side (0=bid, 1=ask)
    ///   [9]      order_type (0=limit, 1=IOC, 2=post_only)
    ///   [10..18] price_in_ticks (u64 LE)
    ///   [18..26] size_in_base_lots (u64 LE)
    ///
    /// TODO: Validate this layout against the Phoenix Legacy IDL
    /// during Phase 5 integration testing.
    fn build_new_order_data(params: &OrderParams) -> Vec<u8> {
        let mut data = Vec::with_capacity(26);
        data.extend_from_slice(&discriminators::NEW_ORDER);

        let side_byte = match params.side {
            OrderSide::Bid => phoenix_side::BID,
            OrderSide::Ask => phoenix_side::ASK,
        };
        data.push(side_byte);

        let order_type_byte = match params.order_type {
            OrderType::Market => phoenix_order_type::IOC,
            OrderType::Limit => phoenix_order_type::LIMIT,
        };
        data.push(order_type_byte);

        data.extend_from_slice(&params.price_in_ticks.to_le_bytes());
        data.extend_from_slice(&params.size_in_base_lots.to_le_bytes());
        data
    }

    /// Builds the instruction data for a Phoenix `cancel_all_orders` CPI.
    fn build_cancel_all_data() -> Vec<u8> {
        discriminators::CANCEL_ALL.to_vec()
    }

    /// Returns the Phoenix program Pubkey.
    fn phoenix_program_id() -> Result<Pubkey> {
        PHOENIX_PROGRAM_ID
            .parse::<Pubkey>()
            .map_err(|_| error!(MeridianError::PhoenixCpiFailed))
    }
}

impl<'a, 'info> OrderBookAdapter<'info> for PhoenixLegacyAdapter<'a, 'info> {
    /// Places an order on the Phoenix Legacy DEX via CPI.
    fn place_order(
        &self,
        params: &OrderParams,
        signer_seeds: &[&[u8]],
    ) -> Result<()> {
        let program_id = Self::phoenix_program_id()?;

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
        let program_id = Self::phoenix_program_id()?;

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
