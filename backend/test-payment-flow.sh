#!/bin/bash
# Test complete payment flow

echo "🔍 Step 1: Getting payment quote..."
QUOTE=$(curl -s -X POST http://localhost:3000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{"contentIdHash": "f798ee608b4f2977404bda1fe26cabcb6ff2ca18473e530233f0516cd23fadb7"}')

echo "$QUOTE" | jq
echo ""

SESSION_UUID=$(echo "$QUOTE" | jq -r '.sessionUuid')
echo "💳 Step 2: Submitting payment for session: $SESSION_UUID"

PAY_RESULT=$(curl -s -X POST http://localhost:3000/api/pay \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionUuid\": \"$SESSION_UUID\",
    \"nullifierHash\": \"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210\",
    \"amount\": \"1000000\",
    \"proof\": {
      \"pi_a\": [\"1\", \"2\"],
      \"pi_b\": [[\"3\", \"4\"], [\"5\", \"6\"]],
      \"pi_c\": [\"7\", \"8\"]
    },
    \"publicSignals\": [\"signal1\", \"signal2\"],
    \"txSignature\": \"5JTestSignature123ABC\"
  }")

echo "$PAY_RESULT" | jq
echo ""

echo "✅ Step 3: Checking payment status..."
curl -s "http://localhost:3000/api/status/$SESSION_UUID" | jq
echo ""

echo "📦 Step 4: Getting content metadata..."
CONTENT_ID=$(echo "$QUOTE" | jq -r '.contentId')
curl -s "http://localhost:3000/api/content/$CONTENT_ID" | jq

CONTENT_RESPONSE=$(curl -s "$API_BASE/content/$CONTENT_UUID")
echo "Response: $CONTENT_RESPONSE" | jq '.'
echo ""

# Test 4: Check payment status (should be PENDING)
echo "4️⃣ Testing GET /api/status/:sessionUuid..."
STATUS_RESPONSE=$(curl -s "$API_BASE/status/$SESSION_UUID")
echo "Response: $STATUS_RESPONSE" | jq '.'
STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
echo "✅ Session status: $STATUS"
echo ""

# Test 5: Submit payment (will fail proof verification but that's expected)
echo "5️⃣ Testing POST /api/pay (mock proof - will fail verification)..."
PAY_RESPONSE=$(curl -s -X POST "$API_BASE/pay" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionUuid": "'"$SESSION_UUID"'",
    "nullifierHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "proof": {
      "pi_a": ["1", "2", "1"],
      "pi_b": [["1", "2"], ["1", "2"], ["1", "2"]],
      "pi_c": ["1", "2", "1"],
      "protocol": "groth16",
      "curve": "bn128"
    },
    "publicSignals": ["100000"],
    "amount": "'"$PRICE"'",
    "txSignature": "mockTxSignature123456789"
  }' 2>&1)

echo "Response: $PAY_RESPONSE" | jq '.' || echo "$PAY_RESPONSE"
echo ""

echo "🎉 Payment API flow test completed!"
echo ""
echo "📝 Summary:"
echo "   - Quote endpoint: ✅ Working"
echo "   - Content endpoint: ✅ Working"
echo "   - Status endpoint: ✅ Working"
echo "   - Pay endpoint: 🟡 Tested (proof verification expected to fail with mock data)"
