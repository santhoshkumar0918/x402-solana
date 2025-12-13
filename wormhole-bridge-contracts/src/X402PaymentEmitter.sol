// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWormhole {
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);
    
    function messageFee() external view returns (uint256);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title X402PaymentEmitter
 * @notice Emits cross-chain payment intents for x402 content on Solana via Wormhole
 * @dev Minimal gas-optimized contract - verification happens off-chain in NestJS backend
 * 
 * Architecture:
 * - Agent calls payForContent() on Base/Ethereum
 * - USDC transferred to contract
 * - Wormhole message emitted with payment metadata
 * - Guardians observe and sign → produce VAA
 * - Backend polls VAA, verifies, unlocks Solana content
 * 
 * Security:
 * - No complex logic (gas-optimized)
 * - Backend handles verification (emitter whitelist, idempotency)
 * - Emergency withdrawal for stuck funds
 */
contract X402PaymentEmitter {
    // ============ Immutables ============
    
    IWormhole public immutable wormhole;
    IERC20 public immutable usdc;
    address public immutable owner;
    
    // ============ State ============
    
    /// @notice Nonce for unique message identification (increments per message)
    uint32 private nonce;
    
    // ============ Events ============
    
    /**
     * @notice Emitted when a payment intent is published to Wormhole
     * @param contentId Content hash from x402 system
     * @param sessionId Unique session identifier from backend
     * @param payer Address that paid for content
     * @param amount USDC amount (6 decimals)
     * @param sequence Wormhole message sequence number (for VAA lookup)
     */
    event PaymentEmitted(
        bytes32 indexed contentId,
        bytes32 indexed sessionId,
        address indexed payer,
        uint256 amount,
        uint64 sequence
    );
    
    /**
     * @notice Emitted when USDC is withdrawn (emergency only)
     * @param to Recipient address
     * @param amount USDC amount withdrawn
     */
    event USDCWithdrawn(address indexed to, uint256 amount);
    
    // ============ Errors ============
    
    error TransferFailed();
    error Unauthorized();
    error InvalidAmount();
    error InvalidContentId();
    error InvalidSessionId();
    
    // ============ Constructor ============
    
    /**
     * @param _wormhole Wormhole Core Contract address
     * @param _usdc USDC token address (Circle's official deployment)
     */
    constructor(address _wormhole, address _usdc) {
        require(_wormhole != address(0), "Invalid wormhole address");
        require(_usdc != address(0), "Invalid USDC address");
        
        wormhole = IWormhole(_wormhole);
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Emit payment intent for cross-chain x402 content access
     * @dev Agent must approve USDC before calling this function
     * 
     * Flow:
     * 1. Transfer USDC from agent to this contract
     * 2. Encode payment metadata
     * 3. Publish message to Wormhole (Guardians will observe)
     * 4. Emit event for off-chain indexing
     * 
     * @param contentId Content hash (sha256 of content metadata)
     * @param sessionId Session UUID from backend (bytes32 encoded)
     * @param externalNullifier Privacy nullifier (optional, use 0x0 if unused)
     * @param amount USDC amount in smallest unit (6 decimals, e.g., 1000000 = 1 USDC)
     * @return sequence Wormhole message sequence number (use this to poll for VAA)
     */
    function payForContent(
        bytes32 contentId,
        bytes32 sessionId,
        bytes32 externalNullifier,
        uint256 amount
    ) external returns (uint64 sequence) {
        // Validation
        if (contentId == bytes32(0)) revert InvalidContentId();
        if (sessionId == bytes32(0)) revert InvalidSessionId();
        if (amount == 0) revert InvalidAmount();
        
        // 1. Transfer USDC from sender
        // Note: Sender must have approved this contract for at least `amount`
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        // 2. Encode payload (must match backend ABI decoder)
        // Backend expects: (bytes32, bytes32, bytes32, address, uint256, uint256)
        bytes memory payload = abi.encode(
            contentId,           // Content identifier
            sessionId,           // Session UUID
            externalNullifier,   // Privacy nullifier (optional)
            msg.sender,          // Payer address (for audit)
            amount,              // USDC amount
            block.timestamp      // Payment timestamp (for expiry checks)
        );
        
        // 3. Publish message to Wormhole
        // Consistency level 1 = finalized (safe for Base/Ethereum)
        sequence = wormhole.publishMessage(
            nonce++,            // Unique nonce
            payload,            // Encoded payment data
            1                   // Consistency level: finalized
        );
        
        // 4. Emit event for off-chain indexing (backend can track via events)
        emit PaymentEmitted(
            contentId,
            sessionId,
            msg.sender,
            amount,
            sequence
        );
        
        // Return sequence for agent to poll VAA status
        return sequence;
    }
    
    /**
     * @notice Emergency USDC withdrawal (owner only)
     * @dev Use this if USDC gets stuck (should never happen in normal operation)
     * @param to Recipient address
     * @param amount USDC amount to withdraw
     */
    function withdrawUSDC(address to, uint256 amount) external {
        if (msg.sender != owner) revert Unauthorized();
        
        bool success = usdc.transfer(to, amount);
        if (!success) revert TransferFailed();
        
        emit USDCWithdrawn(to, amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current nonce (for debugging)
     */
    function getCurrentNonce() external view returns (uint32) {
        return nonce;
    }
    
    /**
     * @notice Get contract's USDC balance (should be ~0 in normal operation)
     */
    function getUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    /**
     * @notice Calculate Wormhole message fee (usually 0 on EVM chains)
     */
    function getMessageFee() external view returns (uint256) {
        return wormhole.messageFee();
    }
}
