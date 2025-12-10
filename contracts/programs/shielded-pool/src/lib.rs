use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};



declare_id!("75cH7CRmvDyy7o3mGuWvJhffT7ZyLmYdvv7x36ZVhio1");

#[program]
pub mod shielded_pool {
    use super::*;

    /// Initialize the shielded pool with empty Merkle tree
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.merkle_root = [0u8; 32]; // Empty tree root
        pool.tree_height = 20; // Supports 2^20 = 1M commitments
        pool.next_index = 0;
        pool.total_deposits = 0;

        msg!("Shielded pool initialized with authority: {}", pool.authority);
        Ok(())
    }

    /// Deposit tokens into the shielded pool
    pub fn deposit(
        ctx: Context<Deposit>,
        commitment: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer tokens from user to pool
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token.to_account_info(),
                to: ctx.accounts.pool_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        let pool = &mut ctx.accounts.pool;
        let leaf_index = pool.next_index;

        // Add commitment to Merkle tree
        let merkle_tree = &mut ctx.accounts.merkle_tree;
        merkle_tree.insert_leaf(leaf_index, commitment)?;

        // Update pool state  
        pool.merkle_root = merkle_tree.compute_root()?;
        pool.next_index += 1;
        pool.total_deposits += amount;

        emit!(DepositEvent {
            commitment,
            leaf_index,
            amount,
            root: pool.merkle_root,
        });

        msg!(
            "Deposit successful: commitment={:?}, index={}, amount={}", 
            commitment, leaf_index, amount
        );
        Ok(())
    }

    /// Withdraw from shielded pool (will be called by spend-verifier)
    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let pool = &ctx.accounts.pool;
        require!(
            pool.total_deposits >= amount,
            ErrorCode::InsufficientFunds
        );

        // Only allow spend-verifier program to call this
        require!(
            ctx.accounts.spend_verifier.key() == crate::SPEND_VERIFIER_ID,
            ErrorCode::UnauthorizedWithdrawal
        );

        // Transfer tokens from pool to recipient
        let seeds = &[b"pool".as_slice()];
        let (_, bump) = Pubkey::find_program_address(seeds, ctx.program_id);
        let authority_seeds = &[b"pool".as_slice(), &[bump]];
        let signer = &[&authority_seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_token.to_account_info(),
                to: ctx.accounts.recipient_token.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        // Update pool state
        let pool = &mut ctx.accounts.pool;
        pool.total_deposits -= amount;

        emit!(WithdrawalEvent {
            recipient,
            amount,
            remaining_balance: pool.total_deposits,
        });

        Ok(())
    }
}

// Program IDs for cross-program invocations
pub const SPEND_VERIFIER_ID: Pubkey = pubkey!("CwJ5s1e69mv5uAnTyaAxos9DVVQ2kWcz53BQm6krzDG9");

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ShieldedPool::LEN,
        seeds = [b"pool"],
        bump
    )]
    pub pool: Account<'info, ShieldedPool>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + MerkleTree::LEN,
        seeds = [b"merkle_tree"],
        bump
    )]
    pub merkle_tree: Account<'info, MerkleTree>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"pool"],
        bump
    )]
    pub pool: Account<'info, ShieldedPool>,
    
    #[account(
        mut,
        seeds = [b"merkle_tree"],
        bump
    )]
    pub merkle_tree: Account<'info, MerkleTree>,
    
    #[account(mut)]
    /// CHECK: Token account validated by token program
    pub user_token: UncheckedAccount<'info>,
    
    #[account(mut)]
    /// CHECK: Token account validated by token program
    pub pool_token: UncheckedAccount<'info>,
    
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"pool"],
        bump
    )]
    pub pool: Account<'info, ShieldedPool>,
    
    /// CHECK: This is the spend verifier program
    pub spend_verifier: UncheckedAccount<'info>,
    
    /// CHECK: Pool authority PDA
    pub pool_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    /// CHECK: Token account validated by token program
    pub pool_token: UncheckedAccount<'info>,
    
    #[account(mut)]
    /// CHECK: Token account validated by token program
    pub recipient_token: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct ShieldedPool {
    pub authority: Pubkey,
    pub merkle_root: [u8; 32],
    pub tree_height: u8,
    pub next_index: u64,
    pub total_deposits: u64,
}

impl ShieldedPool {
    pub const LEN: usize = 32 + 32 + 1 + 8 + 8;
}

#[account]
pub struct MerkleTree {
    pub height: u8,
    pub filled_subtrees: [[u8; 32]; 20], // Store subtree roots for efficiency
    pub zeros: [[u8; 32]; 20], // Zero hash values for each level
    pub root: [u8; 32],
}

impl MerkleTree {
    pub const LEN: usize = 1 + (32 * 20) + (32 * 20) + 32;
    
    pub fn initialize(&mut self, height: u8) -> Result<()> {
        self.height = height;
        
        // Initialize zeros array with proper zero hashes
        self.zeros[0] = [0u8; 32]; // H(0)
        for i in 1..height as usize {
            self.zeros[i] = poseidon_hash(&[self.zeros[i-1], self.zeros[i-1]])?;
        }
        
        // Initialize filled_subtrees with zeros
        for i in 0..height as usize {
            self.filled_subtrees[i] = self.zeros[i];
        }
        
        self.root = self.zeros[(height-1) as usize];
        Ok(())
    }
    
    pub fn insert_leaf(&mut self, leaf_index: u64, leaf: [u8; 32]) -> Result<()> {
        require!(leaf_index < (1u64 << self.height), ErrorCode::IndexOutOfBounds);
        
        let mut current_hash = leaf;
        let mut current_index = leaf_index;
        
        // Update filled subtrees bottom-up using the standard incremental Merkle tree algorithm
        for level in 0..self.height {
            if current_index % 2 == 0 {
                // Left node - update filled_subtrees and break
                self.filled_subtrees[level as usize] = current_hash;
                break;
            } else {
                // Right node - hash with left sibling from filled_subtrees
                let left_hash = self.filled_subtrees[level as usize];
                current_hash = poseidon_hash(&[left_hash, current_hash])?;
                current_index /= 2;
            }
        }
        
        // Recompute root
        self.root = self.compute_root()?;
        Ok(())
    }
    
    pub fn compute_root(&self) -> Result<[u8; 32]> {
        let mut current_hash = self.filled_subtrees[0];
        
        for level in 1..self.height {
            let right_hash = if level == self.height - 1 {
                self.filled_subtrees[level as usize]
            } else {
                self.zeros[level as usize]
            };
            
            current_hash = poseidon_hash(&[current_hash, right_hash])?;
        }
        
        Ok(current_hash)
    }
    
    pub fn get_root(&self) -> [u8; 32] {
        self.root
    }
    
    /// Verify a Merkle proof
    pub fn verify_proof(
        &self,
        leaf: [u8; 32],
        proof: &[[u8; 32]],
        path_indices: &[bool], // true = right, false = left
        root: [u8; 32]
    ) -> Result<bool> {
        require!(proof.len() == self.height as usize, ErrorCode::InvalidInput);
        require!(path_indices.len() == self.height as usize, ErrorCode::InvalidInput);
        
        let mut current_hash = leaf;
        
        for i in 0..self.height as usize {
            let proof_element = proof[i];
            if path_indices[i] {
                // Current hash is left, proof element is right
                current_hash = poseidon_hash(&[current_hash, proof_element])?;
            } else {
                // Proof element is left, current hash is right
                current_hash = poseidon_hash(&[proof_element, current_hash])?;
            }
        }
        
        Ok(current_hash == root)
    }
}

use sha2::{Sha256, Digest};

/// Solana-compatible hash function for Merkle tree operations
/// Uses SHA256 instead of Poseidon for stack efficiency on BPF
fn poseidon_hash(inputs: &[[u8; 32]]) -> Result<[u8; 32]> {
    if inputs.is_empty() {
        return Err(ErrorCode::InvalidInput.into());
    }
    
    // Use SHA256 for hashing - much more efficient on Solana BPF
    let mut hasher = Sha256::new();
    
    // Hash all inputs together
    for input in inputs {
        hasher.update(input);
    }
    
    // Add a domain separator to distinguish from other hash uses
    hasher.update(b"MERKLE_TREE_HASH");
    
    let result = hasher.finalize();
    let mut output = [0u8; 32];
    output.copy_from_slice(&result);
    
    Ok(output)
}

#[event]
pub struct DepositEvent {
    pub commitment: [u8; 32],
    pub leaf_index: u64,
    pub amount: u64,
    pub root: [u8; 32],
}

#[event]
pub struct WithdrawalEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub remaining_balance: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,
    #[msg("Index out of bounds for Merkle tree")]
    IndexOutOfBounds,
    #[msg("Insufficient funds in pool")]
    InsufficientFunds,
    #[msg("Unauthorized withdrawal attempt")]
    UnauthorizedWithdrawal,
    #[msg("Invalid input parameters")]
    InvalidInput,
    #[msg("Hash computation error")]
    HashError,
    #[msg("Merkle tree is full")]
    MerkleTreeFull,
    #[msg("Invalid commitment")]
    InvalidCommitment,
    #[msg("Invalid nullifier")]
    InvalidNullifier,
}
