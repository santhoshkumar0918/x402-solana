use anchor_lang::prelude::*;

use sha2::{Sha256, Digest};




declare_id!("Fst8HV7eM3jNg4VjQWWHJUYxPr6E7AYz9hizZnsKUBT9");

#[program]
pub mod zk_meta_registry {
    use super::*;

    /// Initialize the ZK meta registry
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.circuit_count = 0;

        msg!("ZK Meta Registry initialized with authority: {}", registry.authority);
        Ok(())
    }

    /// Register a new verification key for a circuit
    pub fn register_verification_key(
        ctx: Context<RegisterVerificationKey>,
        circuit_name: String,
        circuit_version: String,
        verification_key_data: Vec<u8>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.authority,
            ErrorCode::Unauthorized
        );
        
        require!(circuit_name.len() <= 32, ErrorCode::CircuitNameTooLong);
        require!(circuit_version.len() <= 16, ErrorCode::VersionTooLong);
        require!(verification_key_data.len() <= 8192, ErrorCode::VerificationKeyTooLarge);
        require!(!verification_key_data.is_empty(), ErrorCode::EmptyVerificationKey);

        // Validate verification key by checking basic structure
        // Ensure the verification key data has a reasonable size and structure
        if verification_key_data.len() < 32 {
            return Err(ErrorCode::InvalidVerificationKey.into());
        }
        
        // Basic validation: ensure it's not all zeros
        if verification_key_data.iter().all(|&x| x == 0) {
            return Err(ErrorCode::InvalidVerificationKey.into());
        }
        
        // Compute verification key hash for integrity
        let mut hasher = Sha256::new();
        hasher.update(&verification_key_data);
        let vk_hash: [u8; 32] = hasher.finalize().into();

        let vk_entry = &mut ctx.accounts.verification_key_entry;
        vk_entry.circuit_name = circuit_name.clone();
        vk_entry.circuit_version = circuit_version.clone();
        vk_entry.verification_key = verification_key_data;
        vk_entry.verification_key_hash = vk_hash;
        vk_entry.registered_at = Clock::get()?.unix_timestamp;
        vk_entry.is_active = true;

        let registry = &mut ctx.accounts.registry;
        registry.circuit_count += 1;

        emit!(VerificationKeyRegistered {
            circuit_name,
            circuit_version,
            authority: ctx.accounts.authority.key(),
            registered_at: vk_entry.registered_at,
        });

        msg!("Verification key registered for circuit: {}", vk_entry.circuit_name);
        Ok(())
    }

    /// Update an existing verification key (for circuit upgrades)
    pub fn update_verification_key(
        ctx: Context<UpdateVerificationKey>,
        new_version: String,
        verification_key_data: Vec<u8>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.authority,
            ErrorCode::Unauthorized
        );

        require!(new_version.len() <= 16, ErrorCode::VersionTooLong);
        require!(verification_key_data.len() <= 8192, ErrorCode::VerificationKeyTooLarge);

        let vk_entry = &mut ctx.accounts.verification_key_entry;
        let old_version = vk_entry.circuit_version.clone();
        
        vk_entry.circuit_version = new_version.clone();
        vk_entry.verification_key = verification_key_data;
        vk_entry.registered_at = Clock::get()?.unix_timestamp;

        emit!(VerificationKeyUpdated {
            circuit_name: vk_entry.circuit_name.clone(),
            old_version,
            new_version,
            updated_at: vk_entry.registered_at,
        });

        msg!("Verification key updated for circuit: {}", vk_entry.circuit_name);
        Ok(())
    }

    /// Deactivate a verification key
    pub fn deactivate_verification_key(
        ctx: Context<DeactivateVerificationKey>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.authority,
            ErrorCode::Unauthorized
        );

        let vk_entry = &mut ctx.accounts.verification_key_entry;
        vk_entry.is_active = false;

        emit!(VerificationKeyDeactivated {
            circuit_name: vk_entry.circuit_name.clone(),
            circuit_version: vk_entry.circuit_version.clone(),
        });

        msg!("Verification key deactivated for circuit: {}", vk_entry.circuit_name);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ZkMetaRegistry::LEN,
        seeds = [b"zk_meta_registry"],
        bump
    )]
    pub registry: Account<'info, ZkMetaRegistry>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(circuit_name: String)]
pub struct RegisterVerificationKey<'info> {
    #[account(mut)]
    pub registry: Account<'info, ZkMetaRegistry>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + VerificationKeyEntry::LEN,
        seeds = [b"vk_entry", circuit_name.as_bytes()],
        bump
    )]
    pub verification_key_entry: Account<'info, VerificationKeyEntry>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateVerificationKey<'info> {
    pub registry: Account<'info, ZkMetaRegistry>,
    
    #[account(
        mut,
        seeds = [b"vk_entry", verification_key_entry.circuit_name.as_bytes()],
        bump
    )]
    pub verification_key_entry: Account<'info, VerificationKeyEntry>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateVerificationKey<'info> {
    pub registry: Account<'info, ZkMetaRegistry>,
    
    #[account(
        mut,
        seeds = [b"vk_entry", verification_key_entry.circuit_name.as_bytes()],
        bump
    )]
    pub verification_key_entry: Account<'info, VerificationKeyEntry>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct ZkMetaRegistry {
    pub authority: Pubkey,
    pub circuit_count: u64,
}

impl ZkMetaRegistry {
    pub const LEN: usize = 32 + 8;
}

#[account]
pub struct VerificationKeyEntry {
    pub circuit_name: String,      // e.g., "spend", "credential"
    pub circuit_version: String,   // e.g., "v2.0", "v3.1"
    pub verification_key: Vec<u8>, // Serialized verification key
    pub verification_key_hash: [u8; 32], // SHA256 hash of verification key for integrity
    pub registered_at: i64,        // Timestamp
    pub is_active: bool,           // Active/inactive status
}

impl VerificationKeyEntry {
    pub const LEN: usize = 4 + 32 + 4 + 16 + 4 + 8192 + 32 + 8 + 1; // Dynamic strings + VK data + hash
}

#[event]
pub struct VerificationKeyRegistered {
    pub circuit_name: String,
    pub circuit_version: String,
    pub authority: Pubkey,
    pub registered_at: i64,
}

#[event]
pub struct VerificationKeyUpdated {
    pub circuit_name: String,
    pub old_version: String,
    pub new_version: String,
    pub updated_at: i64,
}

#[event]
pub struct VerificationKeyDeactivated {
    pub circuit_name: String,
    pub circuit_version: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Circuit name too long (max 32 chars)")]
    CircuitNameTooLong,
    #[msg("Version string too long (max 16 chars)")]
    VersionTooLong,
    #[msg("Verification key too large (max 8KB)")]
    VerificationKeyTooLarge,
    #[msg("Verification key cannot be empty")]
    EmptyVerificationKey,
    #[msg("Invalid verification key format")]
    InvalidVerificationKey,
}
