# Wormhole Bridge Implementation - Quick Start

## What We Built

Cross-chain payment system allowing AI agents to pay for Solana content from Base/Ethereum using Wormhole VAAs.

## Components

### 1. Solidity Contract (Base/Ethereum)
**Location:** `/wormhole-bridge-contracts/src/X402PaymentEmitter.sol`

**Purpose:** Emit payment intents to Wormhole network

**Key Function:**
```solidity
function payForContent(
  bytes32 contentId,
  bytes32 sessionId,
  bytes32 externalNullifier,
  uint256 amount
) external returns (uint64 sequence)
```

### 2. Backend Service (NestJS)
**Location:** `/backend/src/bridge/`

**Files:**
- `bridge.service.ts` - VAA verification logic
- `bridge.controller.ts` - HTTP API endpoints
- `bridge.module.ts` - NestJS module

**Key Endpoint:**
```
POST /api/bridge/verify
Body: { emitterChain, emitterAddress, sequence }
```

### 3. Database Entity
**Location:** `/backend/src/database/entities/CrossChainPayment.ts`

**Migration:** `/backend/migrations/001_cross_chain_payments.sql`

## Deployment Steps

### Step 1: Run Database Migration
```bash
cd backend
# Connect to Supabase and run migration
psql $DATABASE_URL -f migrations/001_cross_chain_payments.sql
```

### Step 2: Build Solidity Contract
```bash
cd ../wormhole-bridge-contracts
forge build
```

### Step 3: Deploy to Base Sepolia
```bash
# Create .env file
cp .env.example .env
# Edit .env with your PRIVATE_KEY

# Deploy contract
forge create src/X402PaymentEmitter.sol:X402PaymentEmitter \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x79A1027a6A159502049F10906D333EC57E95F083 0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Note the deployed contract address!
```

### Step 4: Whitelist Contract in Backend
```typescript
// In backend/src/bridge/bridge.service.ts
// Update line 33-36 with deployed address:
private readonly ALLOWED_EMITTERS = new Map<number, string[]>([
  [30, ['0xYOUR_DEPLOYED_CONTRACT_ADDRESS']], // Base Sepolia
  [2, []],  // Ethereum Sepolia
]);
```

### Step 5: Restart Backend
```bash
cd ../backend
SKIP_PROOF_VERIFICATION=true npm run start:dev
```

## Testing Flow

### 1. Agent Calls Contract on Base
```typescript
// Agent approves USDC
await usdc.approve(emitterAddress, amount);

// Agent pays for content
const tx = await emitter.payForContent(
  contentId,
  sessionId,
  nullifier,
  amount
);

const receipt = await tx.wait();
const sequence = receipt.events[0].args.sequence;
```

### 2. Wait for Guardian Consensus (~2-5 minutes)
Guardians observe the transaction and sign the VAA.

### 3. Backend Verifies VAA
```bash
curl -X POST http://localhost:3000/api/bridge/verify \
  -H "Content-Type: application/json" \
  -d '{
    "emitterChain": 30,
    "emitterAddress": "0xYOUR_CONTRACT",
    "sequence": "1"
  }'
```

### 4. Access Content
```bash
curl http://localhost:3000/api/content/:contentId \
  -H "X-Session-ID: YOUR_SESSION_UUID"
```

## Contract Addresses (Testnet)

### Base Sepolia
- **Wormhole Core:** `0x79A1027a6A159502049F10906D333EC57E95F083`
- **USDC:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **X402PaymentEmitter:** TBD (deploy and update here)

### Ethereum Sepolia
- **Wormhole Core:** `0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78`
- **USDC:** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

## Security Checklist

- [x] Emitter whitelist implemented
- [x] VAA replay protection (hash deduplication)
- [x] Rate limiting (10 req/min)
- [x] Timestamp expiry (1 hour)
- [x] Payload schema validation
- [x] Guardian signature verification (SDK automatic)
- [x] Database indexes for performance
- [ ] Contract deployed and whitelisted
- [ ] Migration run on production DB

## Monitoring

Check backend logs for:
```
[BridgeService] Wormhole SDK initialized for Testnet
[BridgeService] VAA verified: chain=30, seq=1, sigs=13
[BridgeService] Cross-chain payment processed: session=xxx, content=yyy
```

## Common Issues

**"VAA not found"**
- Wait 2-5 minutes after transaction for Guardian consensus
- Check transaction was finalized on source chain

**"Emitter not whitelisted"**
- Update ALLOWED_EMITTERS in bridge.service.ts
- Restart backend

**"Rate limit exceeded"**
- Wait 1 minute before retrying
- Check Redis connectivity

## Next Steps

1. Deploy contract to Base Sepolia
2. Run database migration
3. Whitelist contract address
4. Test end-to-end flow
5. Add MCP tools for agent integration
6. Monitor Guardian latency
7. Optimize gas costs

## References

- [Implementation Plan](../docs/cross-chain-implementation-plan.md)
- [Wormhole Docs](https://docs.wormhole.com/)
- [Foundry Book](https://book.getfoundry.sh/)
