#!/bin/bash
# Test MCP server with complete payment flow

echo "🧪 Testing x402 MCP Server"
echo "============================"
echo ""

# Test 1: List tools
echo "1️⃣ Listing available tools..."
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  npx tsx src/mcp-server.ts 2>/dev/null | tail -1 | jq -r '.result.tools[].name'
echo ""

# Test 2: Get payment quote
echo "2️⃣ Getting payment quote..."
QUOTE_REQUEST='{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_payment_quote",
    "arguments": {
      "contentIdHash": "f798ee608b4f2977404bda1fe26cabcb6ff2ca18473e530233f0516cd23fadb7",
      "hasJournalistCredential": false
    }
  }
}'

QUOTE_RESPONSE=$(echo "$QUOTE_REQUEST" | npx tsx src/mcp-server.ts 2>/dev/null | tail -1)
echo "$QUOTE_RESPONSE" | jq -r '.result.content[0].text' | jq .
echo ""

# Extract session UUID
SESSION_UUID=$(echo "$QUOTE_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.quote.sessionUuid')
PRICE=$(echo "$QUOTE_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.quote.price')

echo "   Session: $SESSION_UUID"
echo "   Price: $PRICE lamports"
echo ""

# Test 3: Complete payment using pay_and_fetch
echo "3️⃣ Testing pay_and_fetch (complete flow)..."
PAY_REQUEST='{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "pay_and_fetch",
    "arguments": {
      "contentIdHash": "f798ee608b4f2977404bda1fe26cabcb6ff2ca18473e530233f0516cd23fadb7",
      "hasJournalistCredential": false,
      "nullifierHash": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "proof": {
        "pi_a": ["1", "2"],
        "pi_b": [["3", "4"], ["5", "6"]],
        "pi_c": ["7", "8"]
      },
      "publicSignals": ["signal1", "signal2"],
      "txSignature": "MCP_Test_Signature_12345"
    }
  }
}'

PAY_RESPONSE=$(echo "$PAY_REQUEST" | npx tsx src/mcp-server.ts 2>/dev/null | tail -1)
echo "$PAY_RESPONSE" | jq -r '.result.content[0].text' | jq .
echo ""

# Extract new session for status check
NEW_SESSION=$(echo "$PAY_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.transaction.sessionUuid')

# Test 4: Check payment status
echo "4️⃣ Checking payment status..."
STATUS_REQUEST='{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "check_payment_status",
    "arguments": {
      "sessionUuid": "'"$NEW_SESSION"'"
    }
  }
}'

STATUS_RESPONSE=$(echo "$STATUS_REQUEST" | npx tsx src/mcp-server.ts 2>/dev/null | tail -1)
echo "$STATUS_RESPONSE" | jq -r '.result.content[0].text' | jq .
echo ""

echo "✅ MCP Server testing complete!"
