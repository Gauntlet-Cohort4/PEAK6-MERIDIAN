use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;

declare_id!("MERDNxo1MzL4cBgMcwhTFPcoVbRg63qjL8Bkbah2rbc");

#[program]
pub mod meridian {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
