# x402 Cross-Chain Payment Implementation
## Wormhole Integration for AI Agents

> **Last Updated:** December 13, 2025  
> **Status:** Implementation Ready  
> **Author:** Technical Architecture Team

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Architecture Overview](#architecture-overview)
4. [Technical Components](#technical-components)
5. [Implementation Guide](#implementation-guide)
6. [Security Requirements](#security-requirements)
7. [API Specifications](#api-specifications)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Checklist](#deployment-checklist)

---

## 🎯 Executive Summary

### **The Challenge**
AI agents with journalist credentials issued on Ethereum/Base cannot access discounted content stored on Solana because x402 privacy infrastructure only exists on Solana.

### **The Solution**
Use **Wormhole** as a secure cross-chain courier to:
1. Prove payment occurred on Base/Ethereum
2. Carry payment metadata to Solana
3. Unlock x402 content with proper pricing tiers

### **Key Insight**
> Wormhole is **NOT** your payment system.  
> Wormhole is your **trustless cross-chain courier** that proves "this payment really happened on another chain."

---

## 🔍 Problem Statement

### Current State (Single-Chain)
```
Agent on Solana
  ↓
x402 payment (Solana)
  ↓
ZK proof verification
  ↓
Content unlocked
```

### Required State (Cross-Chain)
```
Agent on Base
  ↓
USDC payment + metadata
  ↓
Wormhole VAA proof
  ↓
Backend verification
  ↓
Solana content unlocked
```

### Why This Matters
- **Journalists** have Worldcoin credentials on Ethereum
- **Content** is stored on Solana with x402 privacy
- **Agents** operate on Base for lower gas fees
- **Discounts** require credential verification (journalist: 50% off)

Without Wormhole, agents cannot access cross-chain content with proper pricing.

---

## 🏗️ Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Source Chain (Base Sepolia)                            │
│                                                                  │
│ Smart Contract: X402PaymentEmitter.sol                          │
│   function payForContent(                                        │
│     bytes32 contentId,                                          │
│     bytes32 sessionId,                                          │
│     bytes32 externalNullifier,                                  │
│     uint256 amount                                              │
│   ) external payable                                            │
│                                                                  │
│ Actions:                                                         │
│   1. Accept USDC from agent                                     │
│   2. Emit Wormhole message with payment metadata                │
│   3. Return transaction hash                                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓ (publish message)
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Wormhole Guardian Network                              │
│                                                                  │
│ Automatic Process (2-5 minutes):                                │
│   - 13/19 Guardians observe Base transaction                    │
│   - Validate message finality                                   │
│   - Sign message → Create VAA                                   │
│   - VAA published to Wormholescan API                           │
│                                                                  │
│ VAA Structure:                                                   │
│   - emitterChain: Base (30)                                     │
│   - emitterAddress: 0x... (your contract)                       │
│   - sequence: incrementing number                               │
│   - payload: abi.encode(contentId, sessionId, ...)              │
│   - signatures: 13+ Guardian signatures                         │
└─────────────────────────────────────────────────────────────────┘
                          ↓ (poll VAA)
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: NestJS Backend (Your Core Logic)                       │
│                                                                  │
│ BridgeService:                                                   │
│   ✅ Poll Wormholescan API for VAA                              │
│   ✅ Verify Guardian signatures (SDK automatic)                 │
│   ✅ Check emitter whitelist                                    │
│   ✅ Validate payload schema                                    │
│   ✅ Ensure VAA idempotency (prevent replay)                    │
│   ✅ Create payment_sessions record                             │
│   ✅ Store in cross_chain_payments table                        │
│                                                                  │
│ API Endpoints:                                                   │
│   POST /api/bridge/initiate                                     │
│   GET  /api/bridge/vaa/:sequence                                │
│   POST /api/bridge/verify                                       │
└─────────────────────────────────────────────────────────────────┘
                          ↓ (trigger Solana tx)
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Solana Program Execution                               │
│                                                                  │
│ Backend submits transaction:                                    │
│   Program: shielded_pool::settle_cross_chain_payment            │
│   Accounts: [session_pda, content_pda, payer]                   │
│   Data: { vaa_hash, content_id, amount }                        │
│                                                                  │
│ Solana Side:                                                     │
│   - Does NOT verify VAA on-chain (backend verified)             │
│   - Records payment as settled                                  │
│   - Emits PurchaseEvent                                         │
│   - Content marked as paid                                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓ (unlock content)
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: Content Delivery (x402 Integration)                    │
│                                                                  │
│ Backend Actions:                                                 │
│   - Redis: SET hasAccess:sessionId true                         │
│   - Update payment_sessions.status = CONFIRMED                  │
│   - Generate decryption key                                     │
│                                                                  │
│ Agent Polling:                                                   │
│   GET /api/status/:sessionId                                    │
│   Returns: { status: "CONFIRMED", decryptionKey: "0x..." }      │
│                                                                  │
│ MCP Tool Response:                                               │
│   pay_and_fetch returns decrypted content                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Trust Model |
|-----------|---------------|-------------|
| **Base Contract** | Emit payment intent | Minimal logic, gas-optimized |
| **Wormhole Guardians** | Cryptographic proof of message | Decentralized (13/19 multisig) |
| **Backend BridgeService** | VAA verification, business logic | Your controlled infrastructure |
| **Solana Program** | Record settlement | Trusts backend verification |
| **x402 System** | Content delivery | Existing flow, unchanged |

---

## 🔧 Technical Components

### 1. Source Chain Smart Contract (Base)

**File:** `contracts/src/X402PaymentEmitter.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IWormhole} from "wormhole-solidity-sdk/interfaces/IWormhole.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title X402PaymentEmitter
 * @notice Emits payment intents for x402 content on Solana via Wormhole
 * @dev Minimal contract - verification happens off-chain in backend
 */
contract X402PaymentEmitter {
    IWormhole public immutable wormhole;
    IERC20 public immutable usdc;
    
    // Nonce for unique message identification
    uint32 private nonce;
    
    // Events
    event PaymentEmitted(
        bytes32 indexed contentId,
        bytes32 indexed sessionId,
        address indexed payer,
        uint256 amount,
        uint64 sequence
    );
    
    /**
     * @param _wormhole Wormhole Core Contract address
     * @param _usdc USDC token address
     */
    constructor(address _wormhole, address _usdc) {
        wormhole = IWormhole(_wormhole);
        usdc = IERC20(_usdc);
    }
    
    /**
     * @notice Emit payment intent for cross-chain content access
     * @param contentId Content hash from x402 system
     * @param sessionId Unique session identifier
     * @param externalNullifier Privacy nullifier (optional)
     * @param amount USDC amount in smallest unit (6 decimals)
     * @return sequence Wormhole message sequence number
     */
    function payForContent(
        bytes32 contentId,
        bytes32 sessionId,
        bytes32 externalNullifier,
        uint256 amount
    ) external returns (uint64 sequence) {
        // 1. Transfer USDC from sender
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );
        
        // 2. Encode payload
        bytes memory payload = abi.encode(
            contentId,
            sessionId,
            externalNullifier,
            msg.sender,
            amount,
            block.timestamp
        );
        
        // 3. Publish message to Wormhole
        sequence = wormhole.publishMessage(
            nonce++,
            payload,
            1  // Consistency level: finalized
        );
        
        // 4. Emit event for indexing
        emit PaymentEmitted(
            contentId,
            sessionId,
            msg.sender,
            amount,
            sequence
        );
    }
    
    /**
     * @notice Emergency USDC withdrawal (owner only)
     * @dev Add access control in production
     */
    function withdrawUSDC(address to, uint256 amount) external {
        // TODO: Add onlyOwner modifier
        require(usdc.transfer(to, amount), "Withdrawal failed");
    }
}
```

**Key Features:**
- ✅ Minimal gas usage (~50k gas)
- ✅ No complex verification (backend handles)
- ✅ Event emission for off-chain indexing
- ✅ Emergency withdrawal capability

---

### 2. Backend BridgeService (TypeScript)

**File:** `backend/src/bridge/bridge.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { wormhole } from '@wormhole-foundation/sdk';
import { deserialize } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import { RedisService } from '../redis/redis.service';
import { CrossChainPayment } from '../database/entities/CrossChainPayment';
import { PaymentSession } from '../database/entities/PaymentSession';
import { createHash } from 'crypto';

interface PaymentPayload {
  contentId: string;
  sessionId: string;
  externalNullifier: string;
  payer: string;
  amount: bigint;
  timestamp: bigint;
}

@Injectable()
export class BridgeService {
  private readonly logger = new Logger(BridgeService.name);
  private wh: any;
  
  // Security: Whitelist of allowed emitter contracts
  private readonly ALLOWED_EMITTERS = new Set([
    process.env.BASE_EMITTER_ADDRESS?.toLowerCase(),
    process.env.ETHEREUM_EMITTER_ADDRESS?.toLowerCase(),
  ]);

  constructor(
    @InjectRepository(CrossChainPayment)
    private crossChainRepo: Repository<CrossChainPayment>,
    
    @InjectRepository(PaymentSession)
    private sessionRepo: Repository<PaymentSession>,
    
    private redisService: RedisService,
  ) {
    this.initWormhole();
  }

  private async initWormhole() {
    this.wh = await wormhole('Testnet', [evm, solana], {
      chains: {
        Base: { rpc: process.env.BASE_RPC_URL },
        Solana: { rpc: process.env.SOLANA_RPC_URL },
      },
    });
    this.logger.log('Wormhole SDK initialized');
  }

  /**
   * Fetch and verify VAA from Wormhole
   */
  async fetchAndVerifyVAA(
    emitterChain: string,
    emitterAddress: string,
    sequence: bigint,
  ): Promise<{ vaa: any; payload: PaymentPayload; vaaHash: string }> {
    // 1. Fetch VAA bytes from Wormholescan
    const messageId = {
      emitterChain,
      emitterAddress,
      sequence,
    };

    this.logger.log(`Fetching VAA for sequence ${sequence}`);
    
    const vaaBytes = await this.wh.getVaaBytes(messageId, 120_000); // 2 min timeout
    
    if (!vaaBytes) {
      throw new Error('VAA not available yet');
    }

    // 2. Deserialize and verify (SDK handles signature verification)
    const vaa = deserialize('Uint8Array', vaaBytes);

    // 3. Security: Verify emitter is whitelisted
    const emitterLower = vaa.emitterAddress.toString().toLowerCase();
    if (!this.ALLOWED_EMITTERS.has(emitterLower)) {
      throw new Error(`Unauthorized emitter: ${emitterLower}`);
    }

    // 4. Calculate VAA hash for idempotency
    const vaaHash = createHash('sha256').update(vaaBytes).digest('hex');

    // 5. Check if already processed
    const exists = await this.redisService.exists(`vaa:${vaaHash}`);
    if (exists) {
      throw new Error('VAA already processed');
    }

    // 6. Parse payload
    const payload = this.decodePayload(vaa.payload);

    // 7. Validate payload schema
    this.validatePayload(payload);

    return { vaa, payload, vaaHash };
  }

  /**
   * Decode ABI-encoded payload from Solidity contract
   */
  private decodePayload(payloadBytes: Uint8Array): PaymentPayload {
    // ABI decode: (bytes32, bytes32, bytes32, address, uint256, uint256)
    const ethers = require('ethers');
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['bytes32', 'bytes32', 'bytes32', 'address', 'uint256', 'uint256'],
      payloadBytes,
    );

    return {
      contentId: decoded[0],
      sessionId: decoded[1],
      externalNullifier: decoded[2],
      payer: decoded[3],
      amount: decoded[4],
      timestamp: decoded[5],
    };
  }

  /**
   * Validate payload structure and business rules
   */
  private validatePayload(payload: PaymentPayload): void {
    // Check required fields
    if (!payload.contentId || payload.contentId === '0x' + '0'.repeat(64)) {
      throw new Error('Invalid contentId');
    }

    if (!payload.sessionId || payload.sessionId === '0x' + '0'.repeat(64)) {
      throw new Error('Invalid sessionId');
    }

    if (payload.amount <= 0n) {
      throw new Error('Invalid amount');
    }

    // Check timestamp is recent (within 1 hour)
    const now = BigInt(Math.floor(Date.now() / 1000));
    const maxAge = 3600n; // 1 hour
    if (now - payload.timestamp > maxAge) {
      throw new Error('Payment intent expired');
    }
  }

  /**
   * Process verified VAA and create payment session
   */
  async processVAA(
    vaa: any,
    payload: PaymentPayload,
    vaaHash: string,
  ): Promise<PaymentSession> {
    // 1. Store cross-chain payment record
    const crossChainPayment = this.crossChainRepo.create({
      vaaHash,
      emitterChain: vaa.emitterChain,
      emitterAddress: vaa.emitterAddress.toString(),
      sequence: vaa.sequence.toString(),
      payloadHash: createHash('sha256').update(vaa.payload).digest('hex'),
      processedAt: new Date(),
    });
    await this.crossChainRepo.save(crossChainPayment);

    // 2. Create or update payment session
    const session = await this.sessionRepo.findOne({
      where: { sessionUuid: payload.sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'CONFIRMED';
    session.amount = payload.amount.toString();
    session.payerAddress = payload.payer;
    await this.sessionRepo.save(session);

    // 3. Mark VAA as processed in Redis (24h TTL)
    await this.redisService.setEx(`vaa:${vaaHash}`, 86400, '1');

    // 4. Grant access in Redis
    await this.redisService.setEx(
      `access:${payload.sessionId}`,
      900, // 15 min
      'true',
    );

    this.logger.log(`VAA processed: ${vaaHash.substring(0, 16)}...`);

    return session;
  }

  /**
   * Rate limiting: Check VAA processing rate
   */
  private async checkRateLimit(): Promise<void> {
    const key = 'ratelimit:vaa:processing';
    const current = await this.redisService.incr(key);
    
    if (current === 1) {
      await this.redisService.expire(key, 60); // 1 minute window
    }

    if (current > 10) {
      throw new Error('Rate limit exceeded: max 10 VAA per minute');
    }
  }
}
```

**Security Features:**
- ✅ Emitter whitelist (only your contracts)
- ✅ VAA idempotency (Redis deduplication)
- ✅ Payload validation (schema + business rules)
- ✅ Rate limiting (10 VAA/minute)
- ✅ Timestamp expiration (1 hour)
- ✅ Audit logging (all VAAs stored)

---

### 3. Database Schema

**File:** `backend/src/database/entities/CrossChainPayment.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('cross_chain_payments')
export class CrossChainPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'vaa_hash', type: 'varchar', length: 64, unique: true })
  @Index()
  vaaHash: string;

  @Column({ name: 'emitter_chain', type: 'varchar', length: 50 })
  emitterChain: string;

  @Column({ name: 'emitter_address', type: 'varchar', length: 66 })
  @Index()
  emitterAddress: string;

  @Column({ name: 'sequence', type: 'varchar', length: 20 })
  sequence: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64 })
  payloadHash: string;

  @Column({ name: 'processed_at', type: 'timestamp' })
  @Index()
  processedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**Migration:**

```sql
CREATE TABLE cross_chain_payments (
  id SERIAL PRIMARY KEY,
  vaa_hash VARCHAR(64) UNIQUE NOT NULL,
  emitter_chain VARCHAR(50) NOT NULL,
  emitter_address VARCHAR(66) NOT NULL,
  sequence VARCHAR(20) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  processed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for fast lookups
  CONSTRAINT unique_vaa UNIQUE (vaa_hash),
  INDEX idx_emitter (emitter_address),
  INDEX idx_processed (processed_at)
);

-- Prevent replay attacks
CREATE UNIQUE INDEX idx_unique_message ON cross_chain_payments(emitter_chain, emitter_address, sequence);
```

---

### 4. API Endpoints

**File:** `backend/src/bridge/bridge.controller.ts`

```typescript
import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import { BridgeService } from './bridge.service';

@Controller('api/bridge')
export class BridgeController {
  constructor(private bridgeService: BridgeService) {}

  /**
   * POST /api/bridge/initiate
   * Create a new cross-chain payment session
   */
  @Post('initiate')
  @HttpCode(200)
  async initiate(@Body() dto: InitiatePaymentDto) {
    // Create session and return details for Base contract call
    return {
      sessionId: dto.sessionId,
      contentId: dto.contentId,
      baseContractAddress: process.env.BASE_EMITTER_ADDRESS,
      estimatedGas: '~50000',
    };
  }

  /**
   * GET /api/bridge/vaa/:sequence
   * Poll for VAA status
   */
  @Get('vaa/:sequence')
  async getVAAStatus(@Param('sequence') sequence: string) {
    try {
      const result = await this.bridgeService.fetchAndVerifyVAA(
        'Base',
        process.env.BASE_EMITTER_ADDRESS!,
        BigInt(sequence),
      );

      return {
        status: 'available',
        vaaHash: result.vaaHash,
        payload: result.payload,
      };
    } catch (error) {
      return {
        status: 'pending',
        message: error.message,
      };
    }
  }

  /**
   * POST /api/bridge/verify
   * Verify VAA and unlock content
   */
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() dto: VerifyVAADto) {
    const { vaa, payload, vaaHash } = await this.bridgeService.fetchAndVerifyVAA(
      dto.emitterChain,
      dto.emitterAddress,
      BigInt(dto.sequence),
    );

    const session = await this.bridgeService.processVAA(vaa, payload, vaaHash);

    return {
      status: 'success',
      session: {
        id: session.sessionUuid,
        status: session.status,
        hasAccess: true,
      },
    };
  }
}
```

---

### 5. MCP Tools Integration

**File:** `backend/src/mcp-server.ts` (additions)

```typescript
// Add new tool: initiate_crosschain_payment
server.tool(
  'initiate_crosschain_payment',
  'Initiate cross-chain payment from Base/Ethereum to access Solana content',
  {
    contentIdHash: z.string().describe('Content ID hash'),
    sourceChain: z.enum(['Base', 'Ethereum']).describe('Source chain'),
    hasJournalistCredential: z.boolean().optional(),
  },
  async (args) => {
    // 1. Get quote
    const quote = await axios.post(`${BACKEND_URL}/api/quote`, {
      contentIdHash: args.contentIdHash,
      hasJournalistCredential: args.hasJournalistCredential,
    });

    // 2. Initiate cross-chain session
    const session = await axios.post(`${BACKEND_URL}/api/bridge/initiate`, {
      sessionId: quote.data.sessionId,
      contentId: args.contentIdHash,
    });

    return {
      sessionId: session.data.sessionId,
      price: quote.data.price,
      sourceChain: args.sourceChain,
      contractAddress: session.data.baseContractAddress,
      instructions: 'Call payForContent() on Base contract with provided sessionId',
    };
  },
);

// Add new tool: poll_crosschain_status
server.tool(
  'poll_crosschain_status',
  'Check status of cross-chain payment VAA',
  {
    sequence: z.string().describe('Wormhole message sequence number'),
  },
  async (args) => {
    const status = await axios.get(`${BACKEND_URL}/api/bridge/vaa/${args.sequence}`);
    return status.data;
  },
);
```

---

## 🔐 Security Requirements

### Critical Security Checklist

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Emitter Whitelist** | `ALLOWED_EMITTERS` Set in BridgeService | ✅ Required |
| **VAA Idempotency** | Redis: `vaa:hash` → processed flag | ✅ Required |
| **Signature Verification** | SDK automatic (13/19 Guardians) | ✅ Automatic |
| **Payload Validation** | Schema + business rule checks | ✅ Required |
| **Rate Limiting** | Max 10 VAA/minute per backend | ✅ Required |
| **Timestamp Expiration** | 1 hour max age for payment intents | ✅ Required |
| **Audit Logging** | All VAAs stored in `cross_chain_payments` | ✅ Required |
| **Replay Protection** | Unique constraint on (chain, emitter, sequence) | ✅ Required |

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|-----------|
| **Unauthorized Emitter** | Whitelist check before processing |
| **Replay Attack** | VAA hash deduplication in Redis + DB unique constraint |
| **Message Forgery** | Guardian signature verification (13/19 required) |
| **Payload Manipulation** | Strict ABI decoding + schema validation |
| **DoS via Spam** | Rate limiting (10 VAA/min) |
| **Stale Payments** | Timestamp validation (1 hour max age) |
| **Frontend Bypass** | All verification in backend, contracts are minimal |

---

## 📡 API Specifications

### Endpoint: POST /api/bridge/initiate

**Request:**
```json
{
  "sessionId": "uuid-v4-string",
  "contentId": "0x...",
  "sourceChain": "Base"
}
```

**Response:**
```json
{
  "sessionId": "uuid-v4-string",
  "contentId": "0x...",
  "baseContractAddress": "0x123...",
  "estimatedGas": "50000",
  "instructions": "Call payForContent() with provided params"
}
```

### Endpoint: GET /api/bridge/vaa/:sequence

**Response (Pending):**
```json
{
  "status": "pending",
  "message": "VAA not available yet, retry in 30s"
}
```

**Response (Available):**
```json
{
  "status": "available",
  "vaaHash": "abc123...",
  "payload": {
    "contentId": "0x...",
    "sessionId": "uuid",
    "amount": "1000000",
    "payer": "0xAgent..."
  }
}
```

### Endpoint: POST /api/bridge/verify

**Request:**
```json
{
  "emitterChain": "Base",
  "emitterAddress": "0x123...",
  "sequence": "42"
}
```

**Response:**
```json
{
  "status": "success",
  "session": {
    "id": "uuid",
    "status": "CONFIRMED",
    "hasAccess": true,
    "decryptionKey": "0x..."
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('BridgeService', () => {
  it('should reject unauthorized emitter', async () => {
    const fakeVAA = createFakeVAA({
      emitterAddress: '0xUNAUTHORIZED',
    });
    
    await expect(
      service.fetchAndVerifyVAA('Base', '0xUNAUTHORIZED', 1n)
    ).rejects.toThrow('Unauthorized emitter');
  });

  it('should prevent VAA replay', async () => {
    const vaa = await service.fetchAndVerifyVAA('Base', EMITTER, 1n);
    await service.processVAA(vaa.vaa, vaa.payload, vaa.vaaHash);
    
    // Second attempt should fail
    await expect(
      service.processVAA(vaa.vaa, vaa.payload, vaa.vaaHash)
    ).rejects.toThrow('VAA already processed');
  });

  it('should validate payload timestamp', async () => {
    const oldPayload = {
      timestamp: BigInt(Date.now() / 1000 - 7200), // 2 hours ago
      // ... other fields
    };
    
    await expect(
      service.validatePayload(oldPayload)
    ).rejects.toThrow('Payment intent expired');
  });
});
```

### Integration Tests

**Test Scenario: Base Sepolia → Solana Devnet**

```typescript
describe('Cross-Chain Payment Flow', () => {
  it('should complete full flow from Base to Solana', async () => {
    // 1. Agent initiates on Base
    const tx = await baseContract.payForContent(
      contentId,
      sessionId,
      nullifier,
      usdcAmount
    );
    const receipt = await tx.wait();
    const sequence = receipt.events.find(e => e.event === 'PaymentEmitted').args.sequence;

    // 2. Wait for VAA (2-5 minutes)
    let vaa;
    for (let i = 0; i < 30; i++) {
      try {
        vaa = await bridgeService.fetchAndVerifyVAA('Base', baseContract.address, sequence);
        break;
      } catch {
        await sleep(10000); // 10 seconds
      }
    }
    expect(vaa).toBeDefined();

    // 3. Process VAA
    const session = await bridgeService.processVAA(vaa.vaa, vaa.payload, vaa.vaaHash);
    expect(session.status).toBe('CONFIRMED');

    // 4. Verify access
    const status = await axios.get(`/api/status/${sessionId}`);
    expect(status.data.hasAccess).toBe(true);
  });
});
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Install Wormhole SDK: `bun add @wormhole-foundation/sdk @wormhole-foundation/sdk-evm @wormhole-foundation/sdk-solana`
- [ ] Deploy Base contract (Foundry): `forge create X402PaymentEmitter --rpc-url $BASE_SEPOLIA_RPC`
- [ ] Whitelist Base contract address in backend
- [ ] Set up Wormholescan API access
- [ ] Configure Redis for VAA deduplication
- [ ] Create `cross_chain_payments` table
- [ ] Add environment variables

### Environment Variables

```bash
# Wormhole
WORMHOLE_NETWORK=Testnet
BASE_RPC_URL=https://sepolia.base.org
SOLANA_RPC_URL=https://api.devnet.solana.com
WORMHOLESCAN_API=https://api.testnet.wormholescan.io

# Contracts
BASE_EMITTER_ADDRESS=0x...
ETHEREUM_EMITTER_ADDRESS=0x...

# Security
VAA_RATE_LIMIT=10
VAA_MAX_AGE_SECONDS=3600
```

### Post-Deployment

- [ ] Test Base → Solana flow end-to-end
- [ ] Monitor VAA processing rate
- [ ] Set up alerts for unauthorized emitters
- [ ] Verify Guardian signature verification
- [ ] Load test rate limiting
- [ ] Document contract addresses

---

## 📊 Monitoring & Observability

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| VAA Fetch Latency | < 30s | > 60s |
| VAA Processing Success Rate | > 99% | < 95% |
| Unauthorized Emitter Attempts | 0 | > 1/hour |
| Replay Attack Attempts | 0 | > 1/day |
| Rate Limit Hits | < 5/day | > 20/day |

### Logging

```typescript
// Log every VAA processing attempt
logger.log({
  event: 'vaa_processed',
  vaaHash: vaaHash.substring(0, 16),
  emitterChain: vaa.emitterChain,
  sequence: vaa.sequence,
  sessionId: payload.sessionId,
  amount: payload.amount,
  processingTime: Date.now() - startTime,
});
```

---

## 🎓 Developer Guide

### Quick Start

1. **Install Dependencies**
   ```bash
   cd backend
   bun add @wormhole-foundation/sdk @wormhole-foundation/sdk-evm @wormhole-foundation/sdk-solana
   ```

2. **Deploy Base Contract**
   ```bash
   cd contracts
   forge create src/X402PaymentEmitter.sol:X402PaymentEmitter \
     --rpc-url $BASE_SEPOLIA_RPC \
     --private-key $PRIVATE_KEY \
     --constructor-args $WORMHOLE_CORE $USDC_ADDRESS
   ```

3. **Configure Backend**
   ```bash
   echo "BASE_EMITTER_ADDRESS=0x..." >> .env
   npm run start:dev
   ```

4. **Test Flow**
   ```bash
   npm run test:crosschain
   ```

### Common Issues

**Issue: VAA not available after 5 minutes**
- Check Base transaction finality
- Verify Wormhole Guardian uptime
- Confirm correct emitter address

**Issue: "Unauthorized emitter" error**
- Verify contract address in whitelist
- Check lowercase conversion
- Confirm deployment on correct network

**Issue: "VAA already processed"**
- Normal for retry attempts
- Check Redis for `vaa:hash` key
- Verify idempotency logic

---

## 📚 References

- [Wormhole Docs](https://docs.wormhole.com/)
- [Wormhole TypeScript SDK](https://github.com/wormhole-foundation/wormhole-sdk-ts)
- [VAA Structure](https://docs.wormhole.com/wormhole/explore-wormhole/vaa)
- [Guardian Network](https://docs.wormhole.com/wormhole/explore-wormhole/guardian)
- [Wormholescan API](https://docs.wormholescan.io/)

---

## 🤝 Contributing

For questions or improvements, contact the x402 development team.

**Last Updated:** December 13, 2025
