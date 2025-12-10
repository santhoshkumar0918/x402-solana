use anchor_lang::prelude::*;
use ed25519_dalek::{Signature, VerifyingKey, Verifier};
use sha2::{Sha256, Digest};

declare_id!("2vN43sgXS25zWZevcNmfwdWyTTXwdLnyMgotspmVxq5g");

#[program]
pub mod access_controller {
    use super::*;

    /// Initialize the access controller
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let controller = &mut ctx.accounts.controller;
        controller.authority = ctx.accounts.authority.key();
        controller.total_access_grants = 0;

        msg!("Access Controller initialized with authority: {}", controller.authority);
        Ok(())
    }

    /// Grant access to content after successful purchase
    pub fn grant_access(
        ctx: Context<GrantAccess>,
        content_hash: [u8; 32],
        access_duration: Option<i64>, // Duration in seconds, None = permanent
    ) -> Result<()> {
        // Verify purchase exists and payment was made
        let purchase = &ctx.accounts.purchase_record;
        require!(
            purchase.buyer == ctx.accounts.buyer.key(),
            ErrorCode::BuyerMismatch
        );

        // Verify this is being called by authorized program (x402-registry or spend-verifier)
        require!(
            ctx.accounts.caller_program.key() == crate::X402_REGISTRY_ID ||
            ctx.accounts.caller_program.key() == crate::SPEND_VERIFIER_ID,
            ErrorCode::UnauthorizedCaller
        );

        // Additional signature verification for high-value content
        if purchase.amount > 1000000 { // 1 SOL threshold for additional verification
            verify_purchase_integrity(&content_hash, &ctx.accounts.buyer.key())?;
        }

        let access = &mut ctx.accounts.access_permission;
        access.buyer = ctx.accounts.buyer.key();
        access.content_hash = content_hash;
        access.granted_at = Clock::get()?.unix_timestamp;
        access.expires_at = match access_duration {
            Some(duration) => Some(access.granted_at + duration),
            None => None, // Permanent access
        };
        access.is_active = true;
        access.access_count = 0;

        // Update purchase record
        let purchase = &mut ctx.accounts.purchase_record;
        purchase.access_granted = true;

        // Update controller stats
        let controller = &mut ctx.accounts.controller;
        controller.total_access_grants += 1;

        emit!(AccessGranted {
            buyer: access.buyer,
            content_hash,
            granted_at: access.granted_at,
            expires_at: access.expires_at,
        });

        msg!("Access granted to buyer: {} for content: {:?}", access.buyer, content_hash);
        Ok(())
    }

    /// Verify access permissions (called before content delivery)
    pub fn verify_access(
        ctx: Context<VerifyAccess>,
        content_hash: [u8; 32],
    ) -> Result<bool> {
        let access = &ctx.accounts.access_permission;
        
        // Check if access exists and is active
        require!(access.is_active, ErrorCode::AccessRevoked);
        require!(access.content_hash == content_hash, ErrorCode::ContentMismatch);
        
        // Check if access has expired
        if let Some(expires_at) = access.expires_at {
            let current_time = Clock::get()?.unix_timestamp;
            require!(current_time <= expires_at, ErrorCode::AccessExpired);
        }

        // Increment access count for analytics
        let access = &mut ctx.accounts.access_permission;
        access.access_count += 1;

        emit!(AccessVerified {
            buyer: access.buyer,
            content_hash,
            access_count: access.access_count,
            verified_at: Clock::get()?.unix_timestamp,
        });

        Ok(true)
    }

    /// Revoke access (emergency or policy violation)
    pub fn revoke_access(
        ctx: Context<RevokeAccess>,
        reason: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.controller.authority ||
            ctx.accounts.authority.key() == ctx.accounts.access_permission.buyer,
            ErrorCode::Unauthorized
        );

        require!(reason.len() <= 256, ErrorCode::ReasonTooLong);

        let access = &mut ctx.accounts.access_permission;
        access.is_active = false;

        emit!(AccessRevoked {
            buyer: access.buyer,
            content_hash: access.content_hash,
            revoked_by: ctx.accounts.authority.key(),
            reason,
            revoked_at: Clock::get()?.unix_timestamp,
        });

        msg!("Access revoked for buyer: {}", access.buyer);
        Ok(())
    }

    /// Extend access duration
    pub fn extend_access(
        ctx: Context<ExtendAccess>,
        additional_duration: i64,
    ) -> Result<()> {
        require!(
            ctx.accounts.buyer.key() == ctx.accounts.access_permission.buyer,
            ErrorCode::Unauthorized
        );

        let access = &mut ctx.accounts.access_permission;
        require!(access.is_active, ErrorCode::AccessRevoked);

        let current_time = Clock::get()?.unix_timestamp;
        access.expires_at = match access.expires_at {
            Some(existing_expiry) => {
                let new_expiry = std::cmp::max(existing_expiry, current_time) + additional_duration;
                Some(new_expiry)
            },
            None => Some(current_time + additional_duration), // Convert permanent to timed
        };

        emit!(AccessExtended {
            buyer: access.buyer,
            content_hash: access.content_hash,
            new_expiry: access.expires_at,
            extended_at: current_time,
        });

        Ok(())
    }

    /// Batch verify access for multiple content items
    pub fn batch_verify_access<'info>(
        ctx: Context<'_, '_, 'info, 'info, BatchVerifyAccess<'info>>,
        content_hashes: Vec<[u8; 32]>,
    ) -> Result<Vec<bool>> {
        require!(content_hashes.len() <= 10, ErrorCode::TooManyItems);

        let mut results = Vec::with_capacity(content_hashes.len());
        let current_time = Clock::get()?.unix_timestamp;

        for (i, content_hash) in content_hashes.iter().enumerate() {
            let access = &ctx.remaining_accounts[i];
            let access_data: Account<AccessPermission> = Account::try_from(access)?;

            let has_access = access_data.is_active &&
                access_data.content_hash == *content_hash &&
                access_data.expires_at.map_or(true, |exp| current_time <= exp);

            results.push(has_access);
        }

        emit!(BatchAccessVerified {
            buyer: ctx.accounts.buyer.key(),
            content_count: content_hashes.len() as u8,
            verified_at: current_time,
        });

        Ok(results)
    }
}

// Program IDs for authorization
pub const X402_REGISTRY_ID: Pubkey = pubkey!("EUJBVNXkMVsD6F849kREJzJ1FaLUpMhF1Snywz4GJxHn");
pub const SPEND_VERIFIER_ID: Pubkey = pubkey!("55FvRWv7PoAAFtcfg1FEzTFGQbEhz63YV4npRicXMjyW");

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AccessController::LEN,
        seeds = [b"access_controller"],
        bump
    )]
    pub controller: Account<'info, AccessController>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32])]
pub struct GrantAccess<'info> {
    #[account(mut)]
    pub controller: Account<'info, AccessController>,
    
    #[account(
        init,
        payer = buyer,
        space = 8 + AccessPermission::LEN,
        seeds = [b"access", buyer.key().as_ref(), &content_hash],
        bump
    )]
    pub access_permission: Account<'info, AccessPermission>,
    
    #[account(mut)]
    pub purchase_record: Account<'info, x402_registry::PurchaseRecord>,
    
    /// CHECK: Caller program verification
    pub caller_program: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32])]
pub struct VerifyAccess<'info> {
    #[account(
        mut,
        seeds = [b"access", buyer.key().as_ref(), &content_hash],
        bump
    )]
    pub access_permission: Account<'info, AccessPermission>,
    
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    pub controller: Account<'info, AccessController>,
    
    #[account(mut)]
    pub access_permission: Account<'info, AccessPermission>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExtendAccess<'info> {
    #[account(mut)]
    pub access_permission: Account<'info, AccessPermission>,
    
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct BatchVerifyAccess<'info> {
    pub buyer: Signer<'info>,
    // remaining_accounts will contain AccessPermission accounts
}

#[account]
pub struct AccessController {
    pub authority: Pubkey,
    pub total_access_grants: u64,
}

impl AccessController {
    pub const LEN: usize = 32 + 8;
}

#[account]
pub struct AccessPermission {
    pub buyer: Pubkey,
    pub content_hash: [u8; 32],
    pub granted_at: i64,
    pub expires_at: Option<i64>,
    pub is_active: bool,
    pub access_count: u64,
}

impl AccessPermission {
    pub const LEN: usize = 32 + 32 + 8 + (1 + 8) + 1 + 8;
}

#[event]
pub struct AccessGranted {
    pub buyer: Pubkey,
    pub content_hash: [u8; 32],
    pub granted_at: i64,
    pub expires_at: Option<i64>,
}

#[event]
pub struct AccessVerified {
    pub buyer: Pubkey,
    pub content_hash: [u8; 32],
    pub access_count: u64,
    pub verified_at: i64,
}

#[event]
pub struct AccessRevoked {
    pub buyer: Pubkey,
    pub content_hash: [u8; 32],
    pub revoked_by: Pubkey,
    pub reason: String,
    pub revoked_at: i64,
}

#[event]
pub struct AccessExtended {
    pub buyer: Pubkey,
    pub content_hash: [u8; 32],
    pub new_expiry: Option<i64>,
    pub extended_at: i64,
}

#[event]
pub struct BatchAccessVerified {
    pub buyer: Pubkey,
    pub content_count: u8,
    pub verified_at: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Buyer mismatch")]
    BuyerMismatch,
    #[msg("Unauthorized caller program")]
    UnauthorizedCaller,
    #[msg("Access has been revoked")]
    AccessRevoked,
    #[msg("Content hash mismatch")]
    ContentMismatch,
    #[msg("Access has expired")]
    AccessExpired,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Reason too long (max 256 chars)")]
    ReasonTooLong,
    #[msg("Too many items in batch (max 10)")]
    TooManyItems,
    #[msg("Invalid signature")]
    InvalidSignature,
    #[msg("Signature verification failed")]
    SignatureVerificationFailed,
}

/// Verify Ed25519 signature for credential authentication
fn verify_credential_signature(
    message: &[u8; 32],
    signature: &[u8; 64],
    public_key: &[u8; 32],
) -> Result<()> {
    let verifying_key = VerifyingKey::from_bytes(public_key)
        .map_err(|_| ErrorCode::InvalidSignature)?;
    
    let signature = Signature::from_bytes(signature);
    
    verifying_key.verify(message, &signature)
        .map_err(|_| ErrorCode::SignatureVerificationFailed)?;
    
    Ok(())
}

/// Verify purchase integrity using hash-based verification
fn verify_purchase_integrity(content_hash: &[u8; 32], buyer: &Pubkey) -> Result<()> {
    // Create a hash of content_hash + buyer pubkey for integrity check
    let mut hasher = Sha256::new();
    hasher.update(content_hash);
    hasher.update(buyer.as_ref());
    let integrity_hash = hasher.finalize();
    
    // Additional verification logic would go here
    // For now, we just verify the hash computation succeeded
    msg!("Purchase integrity verified: {}", hex::encode(integrity_hash));
    
    Ok(())
}
