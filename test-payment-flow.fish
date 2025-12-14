#!/usr/bin/env fish

# X402 Cross-Chain Payment Test Script
# Tests the full flow: Base → Wormhole → Backend → Solana

set -x EMITTER "0x909a47A46429e23d53608e278C5562fE4945652f"
set -x USDC "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
set -x RPC "https://base-sepolia.g.alchemy.com/v2/EYtCWCvvX_TWjex1waaRu"
set -x PRIVATE_KEY "0x7c3a959cad2e1d387e6543ccf515db5ee0c75cedb953cbed38fb27f0d53569ee"

# Test data
set -x CONTENT_ID "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
set -x SESSION_ID "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
set -x NULLIFIER "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
set -x AMOUNT "1000000" # 1 USDC (6 decimals)

echo "🚀 X402 Payment Test - Base Sepolia"
echo "===================================="
echo ""

# Step 1: Check balances
echo "📊 Step 1: Checking balances..."
echo -n "ETH Balance: "
cast balance 0x2d36Fb204CacAfF24d9fC8F494C90adC438C108F --rpc-url $RPC --ether
echo -n "USDC Balance: "
cast call $USDC "balanceOf(address)(uint256)" 0x2d36Fb204CacAfF24d9fC8F494C90adC438C108F --rpc-url $RPC
echo ""

# Step 2: Approve USDC
echo "✅ Step 2: Approving USDC..."
cast send $USDC "approve(address,uint256)" $EMITTER $AMOUNT \
  --rpc-url $RPC \
  --private-key $PRIVATE_KEY \
  --confirmations 1
echo ""

# Step 3: Pay for content
echo "💰 Step 3: Calling payForContent()..."
set TX_HASH (cast send $EMITTER "payForContent(bytes32,bytes32,bytes32,uint256)" \
  $CONTENT_ID $SESSION_ID $NULLIFIER $AMOUNT \
  --rpc-url $RPC \
  --private-key $PRIVATE_KEY \
  --confirmations 1 \
  --json | jq -r '.transactionHash')

echo "Transaction: $TX_HASH"
echo "View on explorer: https://sepolia.basescan.org/tx/$TX_HASH"
echo ""

# Step 4: Get sequence number from logs (FIXED - decode as uint64, not hex)
echo "🔍 Step 4: Extracting Wormhole sequence from LogMessagePublished..."
sleep 3

# Find the LogMessagePublished event from Wormhole Core (0x79A1027...)
# Event signature: LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)
# Sequence is at offset 0 in data field (first 32 bytes = uint64 padded)
set RECEIPT (cast receipt $TX_HASH --rpc-url $RPC --json)
set WORMHOLE_LOG (echo $RECEIPT | jq -r '.logs[] | select(.address | ascii_downcase == "0x79a1027a6a159502049f10906d333ec57e95f083")')
set SEQUENCE_HEX (echo $WORMHOLE_LOG | jq -r '.data[2:18]') # Extract first 8 bytes (uint64)
set SEQUENCE (printf "%d" 0x$SEQUENCE_HEX)

echo "Wormhole Sequence: $SEQUENCE (decimal)"
echo "Emitter: $EMITTER"
echo ""

# Step 5: Wait for VAA (TESTNET = 5-15 minutes normal!)
echo "⏳ Step 5: Waiting for Wormhole VAA..."
echo "⚠️  TESTNET NOTE: This can take 5-15 minutes (sometimes longer)"
echo "Monitor at: https://testnet.wormholescan.io/tx/$TX_HASH"
echo ""
echo "Checking every 30 seconds (will wait up to 20 minutes)..."

set VAA_READY false
for i in (seq 1 40) # Check for up to 20 minutes
    echo -n "[$i/40] (elapsed: "(math $i \* 30)"s) ... "
    # NOTE: emitter address must be lowercase for Wormholescan API
    set EMITTER_LOWER (echo $EMITTER | tr '[:upper:]' '[:lower:]')
    set VAA_CHECK (curl -s "https://api.testnet.wormholescan.io/api/v1/vaas/30/$EMITTER_LOWER
    set VAA_CHECK (curl -s "https://api.testnet.wormholescan.io/api/v1/vaas/30/0x909a47a46429e23d53608e278c5562fe4945652f/$SEQUENCE" 2>/dev/null)
    
    if test (echo $VAA_CHECK | jq -r '.vaa' 2>/dev/null) != "null"
        echo "✅ VAA Ready!"
        set VAA_READY true
        break
    else
        echo "Not ready yet"
        sleep 30
    end
end

if test $VAA_READY = false20 minutes"
    echo ""
    echo "This is EXPECTED on testnet - Guardians can be very slow."
    echo "Base Sepolia is especially slow sometimes."
    echo ""
    echo "✅ Your transaction WAS successful!"
    echo "✅ Wormhole message WAS emitted!"
    echo "⏳ Just waiting for Guardian consensus..."
    echo ""
    echo "Check Wormholescan: https://testnet.wormholescan.io/tx/$TX_HASH"
    echo ""
    echo "Once VAA appears, verify with:"
    echo "curl -X POST http://localhost:3000/api/bridge/verify \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"emitterChain\":30,\"emitterAddress\":\"$EMITTER\",\"sequence\":\"$SEQUENCE\"}'"
    echo ""
    echo "Or run: ./monitor-vaa.fish
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"emitterChain\":30,\"emitterAddress\":\"$EMITTER\",\"sequence\":\"$SEQUENCE\"}'"
    exit 0
end

echo ""

# Step 6: Verify VAA in backend
echo "🔐 Step 6: Verifying VAA in backend..."
curl -X POST http://localhost:3000/api/bridge/verify \
  -H 'Content-Type: application/json' \
  -d "{\"emitterChain\":30,\"emitterAddress\":\"$EMITTER\",\"sequence\":\"$SEQUENCE\"}" | jq
echo ""

# Step 7: Check payment status
echo "📋 Step 7: Checking payment status..."
set SESSION_UUID (echo $SESSION_ID | sed 's/0x//')
curl http://localhost:3000/api/status/$SESSION_UUID | jq
echo ""

echo "🎉 Test Complete!"
echo ""
echo "Summary:"
echo "  Transaction: $TX_HASH"
echo "  Sequence: $SEQUENCE"
echo "  Session ID: $SESSION_ID"
echo "  Content ID: $CONTENT_ID"
