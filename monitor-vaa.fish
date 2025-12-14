#!/usr/bin/env fish

# Monitor VAA status and verify when ready
# FIXED: Proper sequence handling (decimal, not hex)

set EMITTER "0x909a47a46429e23d53608e278c5562fe4945652f"
set SEQUENCE "0"  # CORRECT: First message from this contract
set TX_HASH "0x153f0f6103c6044071ff02ccb32a28acb54de2f297af4e34a76d7db8c65d1199"

echo "🔍 Monitoring VAA for sequence $SEQUENCE (decimal)"
echo "Emitter: $EMITTER"
echo "Transaction: $TX_HASH"
echo "View at: https://testnet.wormholescan.io/tx/$TX_HASH"
echo ""
echo "⚠️  TESTNET: Guardians can take 5-15 minutes (sometimes longer)"
echo ""

set attempt 1
while true
    echo -n "[$attempt] ("(date +%H:%M:%S)") Checking... "
    
    # Use lowercase emitter for API
    set response (curl -s "https://api.testnet.wormholescan.io/api/v1/vaas/30/$EMITTER/$SEQUENCE")
    set vaa (echo $response | jq -r '.vaa // empty' 2>/dev/null)
    
    if test -n "$vaa"
        echo "✅ VAA READY!"
        echo ""
        echo "Guardian Response:"
        echo $response | jq
        echo ""
        
        # Verify in backend
        echo "🔐 Verifying in backend..."
        set VERIFY_RESPONSE (curl -s -X POST http://localhost:3000/api/bridge/verify \
          -H 'Content-Type: application/json' \
          -d "{\"emitterChain\":30,\"emitterAddress\":\"$EMITTER\",\"sequence\":\"$SEQUENCE\"}")
        
        echo $VERIFY_RESPONSE | jq
        echo ""
        
        if test (echo $VERIFY_RESPONSE | jq -r '.success // false') = "true"
            echo "🎉 SUCCESS! Cross-chain payment verified!"
            echo "✅ Access granted in Redis"
            echo "✅ Solana settlement triggered"
        else
            echo "⚠️  Backend verification issue:"
            echo $VERIFY_RESPONSE | jq -r '.message // .error // "Unknown error"'
        end
        
        break
    else
        set error_msg (echo $response | jq -r '.message // empty')
        if test -n "$error_msg"
            echo "Not ready - $error_msg (elapsed: "(math $attempt \* 30)"s)"
        else
            echo "Not ready (elapsed: "(math $attempt \* 30)"s)"
        end
        sleep 30
        set attempt (math $attempt + 1)
    end
end
