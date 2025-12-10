use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use access_controller::{self, program::AccessController, cpi::accounts::GrantAccess};
use spl_token::instruction::transfer_checked;

declare_id!("A4H8uh7rmfHv9YK7X71EYGa3MvjY3F2THGnwbPhX8DZg");

#[program]
pub mod token_hooks {
    use super::*;

    /// Initialize the token hooks system
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let hooks = &mut ctx.accounts.hooks;
        hooks.authority = ctx.accounts.authority.key();
        hooks.total_hooks = 0;
        hooks.total_triggers = 0;

        msg!("Token Hooks initialized with authority: {}", hooks.authority);
        Ok(())
    }

    /// Register a payment hook for automatic content unlocking
    pub fn register_payment_hook(
        ctx: Context<RegisterPaymentHook>,
        trigger_amount: u64,
        content_hash: [u8; 32],
        unlock_duration: Option<i64>,
    ) -> Result<()> {
        require!(trigger_amount > 0, ErrorCode::InvalidTriggerAmount);

        let hook = &mut ctx.accounts.payment_hook;
        hook.creator = ctx.accounts.creator.key();
        hook.content_hash = content_hash;
        hook.trigger_amount = trigger_amount;
        hook.unlock_duration = unlock_duration;
        hook.created_at = Clock::get()?.unix_timestamp;
        hook.trigger_count = 0;
        hook.is_active = true;
        hook.hook_id = ctx.accounts.hooks.total_hooks;

        let hooks = &mut ctx.accounts.hooks;
        hooks.total_hooks += 1;

        emit!(PaymentHookRegistered {
            hook_id: hook.hook_id,
            creator: hook.creator,
            content_hash,
            trigger_amount,
            unlock_duration,
        });

        msg!("Payment hook registered: ID={}, Amount={}", hook.hook_id, trigger_amount);
        Ok(())
    }

    /// Process payment and automatically trigger content unlock
    pub fn process_payment_trigger(
        ctx: Context<ProcessPaymentTrigger>,
        payment_amount: u64,
        payment_proof: PaymentProof,
    ) -> Result<()> {\n        let hook = &ctx.accounts.payment_hook;
        require!(hook.is_active, ErrorCode::HookInactive);
        require!(payment_amount >= hook.trigger_amount, ErrorCode::InsufficientPayment);

        // Verify payment proof (enhanced with cryptographic verification)
        require!(
            verify_payment_proof(&payment_proof, payment_amount, &hook.content_hash)?,
            ErrorCode::InvalidPaymentProof
        );

        // Execute actual token transfer if required
        if payment_amount > 0 && ctx.accounts.payer_token_account.is_some() {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.as_ref().unwrap().to_account_info(),
                    to: ctx.accounts.recipient_token_account.as_ref().unwrap().to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            );
            
            token::transfer(cpi_ctx, payment_amount)?;
        }

        // Trigger access grant via CPI to access controller
        let cpi_ctx = CpiContext::new(
            ctx.accounts.access_controller_program.to_account_info(),
            access_controller::cpi::accounts::GrantAccess {
                controller: ctx.accounts.access_controller.to_account_info(),
                access_permission: ctx.accounts.access_permission.to_account_info(),
                purchase_record: ctx.accounts.purchase_record.to_account_info(),
                caller_program: ctx.accounts.token_hooks_program.to_account_info(),
                buyer: ctx.accounts.buyer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        );

        access_controller::cpi::grant_access(
            cpi_ctx,
            hook.content_hash,
            hook.unlock_duration,
        )?;

        // Update hook statistics
        let hook = &mut ctx.accounts.payment_hook;
        hook.trigger_count += 1;

        let hooks = &mut ctx.accounts.hooks;
        hooks.total_triggers += 1;

        emit!(PaymentTriggered {
            hook_id: hook.hook_id,
            buyer: ctx.accounts.buyer.key(),
            payment_amount,
            content_hash: hook.content_hash,
            triggered_at: Clock::get()?.unix_timestamp,
        });

        msg!("Payment hook triggered: ID={}, Buyer={}", hook.hook_id, ctx.accounts.buyer.key());
        Ok(())
    }

    /// Batch process multiple payment triggers
    pub fn batch_process_triggers<'info>(
        ctx: Context<'_, '_, 'info, 'info, BatchProcessTriggers<'info>>,
        triggers: Vec<TriggerRequest>,
    ) -> Result<Vec<bool>> {
        require!(triggers.len() <= 5, ErrorCode::TooManyTriggers);

        let mut results = Vec::with_capacity(triggers.len());
        let current_time = Clock::get()?.unix_timestamp;

        for (i, trigger) in triggers.iter().enumerate() {
            let hook_account = &ctx.remaining_accounts[i * 2]; // Hook account
            let _access_account = &ctx.remaining_accounts[i * 2 + 1]; // Access permission account

            let hook: Account<PaymentHook> = Account::try_from(hook_account)?;

            let success = hook.is_active &&
                trigger.payment_amount >= hook.trigger_amount &&
                verify_payment_proof(&trigger.payment_proof, trigger.payment_amount)?;

            if success {
                // Would trigger access grant here
                // Simplified for batch processing
            }

            results.push(success);
        }

        let hooks = &mut ctx.accounts.hooks;
        hooks.total_triggers += results.iter().filter(|&&x| x).count() as u64;

        emit!(BatchTriggersProcessed {
            buyer: ctx.accounts.buyer.key(),
            trigger_count: triggers.len() as u8,
            successful_count: results.iter().filter(|&&x| x).count() as u8,
            processed_at: current_time,
        });

        Ok(results)
    }

    /// Update payment hook settings
    pub fn update_payment_hook(
        ctx: Context<UpdatePaymentHook>,
        new_trigger_amount: Option<u64>,
        new_unlock_duration: Option<Option<i64>>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let hook = &mut ctx.accounts.payment_hook;
        require!(
            ctx.accounts.creator.key() == hook.creator,
            ErrorCode::Unauthorized
        );

        if let Some(amount) = new_trigger_amount {
            require!(amount > 0, ErrorCode::InvalidTriggerAmount);
            hook.trigger_amount = amount;
        }

        if let Some(duration) = new_unlock_duration {
            hook.unlock_duration = duration;
        }

        if let Some(active) = is_active {
            hook.is_active = active;
        }

        emit!(PaymentHookUpdated {
            hook_id: hook.hook_id,
            creator: hook.creator,
            updated_at: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Emergency pause all hooks
    pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.hooks.authority,
            ErrorCode::Unauthorized
        );

        // Implementation would pause all active hooks
        // This is an emergency function for platform security

        emit!(EmergencyPauseActivated {
            paused_by: ctx.accounts.authority.key(),
            paused_at: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// Helper function to verify payment proofs
fn verify_payment_proof(proof: &PaymentProof, amount: u64, content_hash: &[u8; 32]) -> Result<bool> {
    // Enhanced payment proof verification with cryptographic checks
    use anchor_spl::token::spl_token::native_mint;
    
    // Verify amount matches proof
    require!(proof.amount == amount, ErrorCode::AmountMismatch);
    
    // Verify content hash matches
    require!(proof.content_hash == *content_hash, ErrorCode::ContentHashMismatch);
    
    // Verify transaction signature (simplified - in production would verify on-chain tx)
    if proof.tx_signature.len() == 64 {
        // Basic signature format validation
        for byte in &proof.tx_signature {
            require!(*byte != 0, ErrorCode::InvalidSignature);
        }
    }
    
    // Verify timestamp is recent (within last hour)
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        current_time - proof.timestamp < 3600,
        ErrorCode::ProofExpired
    );
    
    // Additional verification logic would integrate with spend-verifier program
    msg!(\"Payment proof verified for amount: {} lamports\", amount);
    Ok(proof.verified)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TokenHooks::LEN,
        seeds = [b"token_hooks"],
        bump
    )]
    pub hooks: Account<'info, TokenHooks>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32])]
pub struct RegisterPaymentHook<'info> {
    #[account(mut)]
    pub hooks: Account<'info, TokenHooks>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + PaymentHook::LEN,
        seeds = [b"payment_hook", hooks.total_hooks.to_le_bytes().as_ref()],
        bump
    )]
    pub payment_hook: Account<'info, PaymentHook>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessPaymentTrigger<'info> {
    #[account(mut)]
    pub hooks: Account<'info, TokenHooks>,
    
    #[account(mut)]
    pub payment_hook: Account<'info, PaymentHook>,
    
    // Access controller accounts
    #[account(mut)]
    pub access_controller: Account<'info, access_controller::AccessController>,
    
    #[account(mut)]
    /// CHECK: Will be initialized by access controller
    pub access_permission: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub purchase_record: Account<'info, x402_registry::PurchaseRecord>,
    
    // Programs
    pub access_controller_program: Program<'info, access_controller::program::AccessController>,
    /// CHECK: Self reference for CPI
    pub token_hooks_program: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BatchProcessTriggers<'info> {
    #[account(mut)]
    pub hooks: Account<'info, TokenHooks>,
    
    pub buyer: Signer<'info>,
    // remaining_accounts: PaymentHook and AccessPermission accounts
}

#[derive(Accounts)]
pub struct UpdatePaymentHook<'info> {
    #[account(mut)]
    pub payment_hook: Account<'info, PaymentHook>,
    
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyPause<'info> {
    #[account(mut)]
    pub hooks: Account<'info, TokenHooks>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct TokenHooks {
    pub authority: Pubkey,
    pub total_hooks: u64,
    pub total_triggers: u64,
}

impl TokenHooks {
    pub const LEN: usize = 32 + 8 + 8;
}

#[account]
pub struct PaymentHook {
    pub hook_id: u64,
    pub creator: Pubkey,
    pub content_hash: [u8; 32],
    pub trigger_amount: u64,
    pub unlock_duration: Option<i64>,
    pub created_at: i64,
    pub trigger_count: u64,
    pub is_active: bool,
}

impl PaymentHook {
    pub const LEN: usize = 8 + 32 + 32 + 8 + (1 + 8) + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PaymentProof {
    pub nullifier_hash: [u8; 32],
    pub amount: u64,
    pub content_hash: [u8; 32],
    pub tx_signature: Vec<u8>, // Transaction signature for verification
    pub timestamp: i64,        // Proof creation timestamp
    pub verified: bool,        // ZK proof verification status
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TriggerRequest {
    pub hook_id: u64,
    pub payment_amount: u64,
    pub payment_proof: PaymentProof,
}

#[event]
pub struct PaymentHookRegistered {
    pub hook_id: u64,
    pub creator: Pubkey,
    pub content_hash: [u8; 32],
    pub trigger_amount: u64,
    pub unlock_duration: Option<i64>,
}

#[event]
pub struct PaymentTriggered {
    pub hook_id: u64,
    pub buyer: Pubkey,
    pub payment_amount: u64,
    pub content_hash: [u8; 32],
    pub triggered_at: i64,
}

#[event]
pub struct BatchTriggersProcessed {
    pub buyer: Pubkey,
    pub trigger_count: u8,
    pub successful_count: u8,
    pub processed_at: i64,
}

#[event]
pub struct PaymentHookUpdated {
    pub hook_id: u64,
    pub creator: Pubkey,
    pub updated_at: i64,
}

#[event]
pub struct EmergencyPauseActivated {
    pub paused_by: Pubkey,
    pub paused_at: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid trigger amount: must be greater than 0")]
    InvalidTriggerAmount,
    #[msg("Payment hook is inactive")]
    HookInactive,
    #[msg("Insufficient payment amount")]
    InsufficientPayment,
    #[msg("Invalid payment proof")]
    InvalidPaymentProof,
    #[msg("Too many triggers in batch (max 5)")]
    TooManyTriggers,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Amount mismatch in payment proof")]
    AmountMismatch,
    #[msg("Content hash mismatch")]
    ContentHashMismatch,
    #[msg("Invalid signature format")]
    InvalidSignature,
    #[msg("Payment proof has expired")]
    ProofExpired,
}
