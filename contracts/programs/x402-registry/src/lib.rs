use anchor_lang::prelude::*;

declare_id!("2a65ey6veP6vqa54K1AHg4fidM2YMH8cBLxacHNz8KCR");

#[program]
pub mod x402_registry {
    use super::*;

    /// Initialize the x402 content registry
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.listing_count = 0;
        registry.total_revenue = 0;
        registry.platform_fee_bps = 200; // 2% platform fee

        msg!("x402 Registry initialized with authority: {}", registry.authority);
        Ok(())
    }

    /// Register new content for sale
    pub fn register_content(
        ctx: Context<RegisterContent>,
        content_hash: [u8; 32],
        pricing_config: PricingConfig,
        required_credentials: Vec<CredentialRequirement>,
        zk_attestations: Vec<ZkAttestation>,
        metadata: ContentMetadata,
    ) -> Result<()> {
        require!(pricing_config.base_price > 0, ErrorCode::InvalidPrice);
        require!(content_hash != [0u8; 32], ErrorCode::InvalidContentHash);
        require!(metadata.title.len() <= 128, ErrorCode::TitleTooLong);
        require!(metadata.description.len() <= 512, ErrorCode::DescriptionTooLong);

        let listing = &mut ctx.accounts.listing;
        listing.creator = ctx.accounts.creator.key();
        listing.content_hash = content_hash;
        listing.pricing = pricing_config.clone();
        listing.required_credentials = required_credentials;
        listing.zk_attestations = zk_attestations.clone();
        listing.metadata = metadata.clone();
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.updated_at = listing.created_at;
        listing.purchase_count = 0;
        listing.total_revenue = 0;
        listing.is_active = true;
        listing.listing_id = ctx.accounts.registry.listing_count;

        let registry = &mut ctx.accounts.registry;
        registry.listing_count += 1;

        emit!(ContentRegistered {
            listing_id: listing.listing_id,
            creator: listing.creator,
            content_hash,
            base_price: pricing_config.base_price,
            zk_proofs: zk_attestations.len() as u8,
        });

        msg!(
            "Content registered: ID={}, Creator={}, Price={}", 
            listing.listing_id, listing.creator, pricing_config.base_price
        );
        Ok(())
    }

    /// Purchase content with ZK proof payment
    pub fn purchase_content(
        ctx: Context<PurchaseContent>,
        buyer_credentials: Vec<CredentialProof>,
    ) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.is_active, ErrorCode::ListingInactive);

        // Calculate final price based on credentials
        let final_price = calculate_price_with_discounts(
            &listing.pricing,
            &listing.required_credentials,
            &buyer_credentials,
        )?;

        // Create purchase record
        let purchase = &mut ctx.accounts.purchase;
        purchase.listing_id = listing.listing_id;
        purchase.buyer = ctx.accounts.buyer.key();
        purchase.seller = listing.creator;
        purchase.final_price = final_price;
        purchase.purchased_at = Clock::get()?.unix_timestamp;
        purchase.credentials_used = buyer_credentials;
        purchase.access_granted = false; // Will be set by access controller

        // Update listing stats
        let listing = &mut ctx.accounts.listing;
        listing.purchase_count += 1;
        listing.total_revenue += final_price;
        listing.updated_at = Clock::get()?.unix_timestamp;

        // Update registry stats
        let registry = &mut ctx.accounts.registry;
        let platform_fee = (final_price * registry.platform_fee_bps as u64) / 10000;
        registry.total_revenue += platform_fee;

        emit!(ContentPurchased {
            listing_id: listing.listing_id,
            buyer: purchase.buyer,
            seller: purchase.seller,
            price_paid: final_price,
            platform_fee,
        });

        msg!(
            "Content purchased: Listing={}, Buyer={}, Price={}", 
            listing.listing_id, purchase.buyer, final_price
        );
        Ok(())
    }

    /// Update content listing
    pub fn update_listing(
        ctx: Context<UpdateListing>,
        new_pricing: Option<PricingConfig>,
        new_metadata: Option<ContentMetadata>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        require!(
            ctx.accounts.creator.key() == listing.creator,
            ErrorCode::Unauthorized
        );

        if let Some(pricing) = new_pricing {
            require!(pricing.base_price > 0, ErrorCode::InvalidPrice);
            listing.pricing = pricing;
        }

        if let Some(metadata) = new_metadata {
            require!(metadata.title.len() <= 128, ErrorCode::TitleTooLong);
            require!(metadata.description.len() <= 512, ErrorCode::DescriptionTooLong);
            listing.metadata = metadata;
        }

        if let Some(active) = is_active {
            listing.is_active = active;
        }

        listing.updated_at = Clock::get()?.unix_timestamp;

        emit!(ListingUpdated {
            listing_id: listing.listing_id,
            creator: listing.creator,
            updated_at: listing.updated_at,
        });

        Ok(())
    }

    /// Set platform fee (admin only)
    pub fn set_platform_fee(
        ctx: Context<SetPlatformFee>,
        new_fee_bps: u16,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.authority,
            ErrorCode::Unauthorized
        );
        require!(new_fee_bps <= 1000, ErrorCode::FeeTooHigh); // Max 10%

        let registry = &mut ctx.accounts.registry;
        let old_fee = registry.platform_fee_bps;
        registry.platform_fee_bps = new_fee_bps;

        emit!(PlatformFeeUpdated {
            old_fee_bps: old_fee,
            new_fee_bps,
            updated_by: ctx.accounts.authority.key(),
        });

        Ok(())
    }
}

// Helper function for dynamic pricing
fn calculate_price_with_discounts(
    pricing: &PricingConfig,
    requirements: &[CredentialRequirement],
    proofs: &[CredentialProof],
) -> Result<u64> {
    let mut final_price = pricing.base_price;

    // Apply credential-based discounts
    for req in requirements {
        if let Some(_proof) = proofs.iter().find(|p| p.credential_type == req.credential_type) {
            let discount = pricing.credential_discounts
                .iter()
                .find(|d| d.credential_type == req.credential_type)
                .map(|d| d.discount_bps)
                .unwrap_or(0);
            
            if discount > 0 {
                let discount_amount = (final_price * discount as u64) / 10000;
                final_price = final_price.saturating_sub(discount_amount);
            }
        }
    }

    // Apply volume discounts
    if let Some(_volume_discount) = &pricing.volume_discount {
        // Volume discount logic would check purchase history
        // For now, just apply if buyer has required volume
        // This would be implemented with purchase history tracking
    }

    Ok(final_price)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + X402Registry::LEN,
        seeds = [b"x402_registry"],
        bump
    )]
    pub registry: Account<'info, X402Registry>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32])]
pub struct RegisterContent<'info> {
    #[account(mut)]
    pub registry: Account<'info, X402Registry>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + ContentListing::LEN,
        seeds = [b"listing", registry.listing_count.to_le_bytes().as_ref()],
        bump
    )]
    pub listing: Account<'info, ContentListing>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchaseContent<'info> {
    #[account(mut)]
    pub registry: Account<'info, X402Registry>,
    
    #[account(mut)]
    pub listing: Account<'info, ContentListing>,
    
    #[account(
        init,
        payer = buyer,
        space = 8 + PurchaseRecord::LEN,
        seeds = [b"purchase", listing.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub purchase: Account<'info, PurchaseRecord>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    #[account(mut)]
    pub listing: Account<'info, ContentListing>,
    
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPlatformFee<'info> {
    #[account(mut)]
    pub registry: Account<'info, X402Registry>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct X402Registry {
    pub authority: Pubkey,
    pub listing_count: u64,
    pub total_revenue: u64,
    pub platform_fee_bps: u16, // Basis points (100 = 1%)
}

impl X402Registry {
    pub const LEN: usize = 32 + 8 + 8 + 2;
}

#[account]
pub struct ContentListing {
    pub listing_id: u64,
    pub creator: Pubkey,
    pub content_hash: [u8; 32],
    pub pricing: PricingConfig,
    pub required_credentials: Vec<CredentialRequirement>,
    pub zk_attestations: Vec<ZkAttestation>,
    pub metadata: ContentMetadata,
    pub created_at: i64,
    pub updated_at: i64,
    pub purchase_count: u64,
    pub total_revenue: u64,
    pub is_active: bool,
}

impl ContentListing {
    pub const LEN: usize = 8 + 32 + 32 + PricingConfig::LEN + 
                           (4 + CredentialRequirement::LEN * 10) + 
                           (4 + ZkAttestation::LEN * 5) + 
                           ContentMetadata::LEN + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct PurchaseRecord {
    pub listing_id: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub final_price: u64,
    pub purchased_at: i64,
    pub credentials_used: Vec<CredentialProof>,
    pub access_granted: bool,
}

impl PurchaseRecord {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + (4 + CredentialProof::LEN * 5) + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CredentialDiscount {
    pub credential_type: CredentialType,
    pub discount_bps: u16, // Discount in basis points
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PricingConfig {
    pub base_price: u64,
    pub credential_discounts: Vec<CredentialDiscount>,
    pub volume_discount: Option<VolumeDiscount>,
}

impl PricingConfig {
    pub const LEN: usize = 8 + (4 + CredentialDiscount::LEN * 10) + (1 + VolumeDiscount::LEN);
}

impl CredentialDiscount {
    pub const LEN: usize = 32 + 2; // CredentialType + u16
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VolumeDiscount {
    pub min_purchases: u32,
    pub discount_bps: u16,
}

impl VolumeDiscount {
    pub const LEN: usize = 4 + 2;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum CredentialType {
    Journalist,
    Human,
    Organization,
    Developer,
    Custom(String),
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CredentialRequirement {
    pub credential_type: CredentialType,
    pub required: bool, // true = required, false = optional for discounts
}

impl CredentialRequirement {
    pub const LEN: usize = 1 + 32 + 1; // enum + string + bool
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CredentialProof {
    pub credential_type: CredentialType,
    pub proof_data: Vec<u8>, // ZK proof of credential ownership
    pub issuer_pubkey: Pubkey,
}

impl CredentialProof {
    pub const LEN: usize = 1 + 32 + (4 + 256) + 32; // enum + string + proof + pubkey
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ZkAttestation {
    pub attestation_type: AttestationType,
    pub proof_data: Vec<u8>,
    pub verified_at: i64,
}

impl ZkAttestation {
    pub const LEN: usize = 1 + 8 + (4 + 256) + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum AttestationType {
    EmailDomain,    // Proves email from specific domain
    Timestamp,      // Proves content created at specific time
    GpsLocation,    // Proves content created at location
    SensorData,     // Proves IoT sensor authenticity
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ContentMetadata {
    pub title: String,
    pub description: String,
    pub category: ContentCategory,
    pub tags: Vec<String>,
}

impl ContentMetadata {
    pub const LEN: usize = (4 + 128) + (4 + 512) + 1 + (4 + 32 * 10);
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum ContentCategory {
    Documents,
    DataFeed,
    Media,
    Code,
    Other,
}

#[event]
pub struct ContentRegistered {
    pub listing_id: u64,
    pub creator: Pubkey,
    pub content_hash: [u8; 32],
    pub base_price: u64,
    pub zk_proofs: u8,
}

#[event]
pub struct ContentPurchased {
    pub listing_id: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub price_paid: u64,
    pub platform_fee: u64,
}

#[event]
pub struct ListingUpdated {
    pub listing_id: u64,
    pub creator: Pubkey,
    pub updated_at: i64,
}

#[event]
pub struct PlatformFeeUpdated {
    pub old_fee_bps: u16,
    pub new_fee_bps: u16,
    pub updated_by: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid price: must be greater than 0")]
    InvalidPrice,
    #[msg("Invalid content hash")]
    InvalidContentHash,
    #[msg("Title too long (max 128 chars)")]
    TitleTooLong,
    #[msg("Description too long (max 512 chars)")]
    DescriptionTooLong,
    #[msg("Listing is inactive")]
    ListingInactive,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Platform fee too high (max 10%)")]
    FeeTooHigh,
}
