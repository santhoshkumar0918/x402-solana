use anchor_lang::prelude::*;

declare_id!("BHNvgS6GVAvNwVDRqan9zgRbLy91FknCSEyEw1SToWv3");

#[program]
pub mod contracts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
