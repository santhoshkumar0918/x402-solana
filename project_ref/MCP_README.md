# x402 MCP Server

AI-powered payment server for privacy-preserving content access using Model Context Protocol.

## Features

- **get_payment_quote** - Get pricing and session for content
- **submit_payment** - Submit ZK proof and receive decryption key
- **check_payment_status** - Verify payment and access status
- **get_content_metadata** - Retrieve content details and pricing
- **pay_and_fetch** - Complete payment flow in one call

## Installation

Make sure the backend API is running:

```bash
SKIP_PROOF_VERIFICATION=true npm run start:dev
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-payment": {
      "command": "node",
      "args": [
        "--loader",
        "ts-node/esm",
        "/path/to/backend/src/mcp-server.ts"
      ],
      "env": {
        "API_BASE_URL": "http://localhost:3000/api"
      }
    }
  }
}
```

Or run directly:

```bash
npm run mcp
```

## Example Usage

### Get Payment Quote

```typescript
{
  "tool": "get_payment_quote",
  "arguments": {
    "contentIdHash": "f798ee608b4f2977404bda1fe26cabcb6ff2ca18473e530233f0516cd23fadb7",
    "hasJournalistCredential": false
  }
}
```

### Complete Payment Flow

```typescript
{
  "tool": "pay_and_fetch",
  "arguments": {
    "contentIdHash": "f798ee608b4f2977404bda1fe26cabcb6ff2ca18473e530233f0516cd23fadb7",
    "hasJournalistCredential": false,
    "nullifierHash": "fedcba9876543210...",
    "proof": {
      "pi_a": ["1", "2"],
      "pi_b": [["3", "4"], ["5", "6"]],
      "pi_c": ["7", "8"]
    },
    "publicSignals": ["signal1", "signal2"]
  }
}
```

## Environment Variables

- `API_BASE_URL` - Backend API URL (default: http://localhost:3000/api)

## Testing

```bash
# Test with the backend server running
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npm run mcp
```

## Architecture

The MCP server acts as a bridge between AI agents (like Claude) and the x402 payment backend:

```
┌─────────┐         ┌─────────────┐         ┌──────────────┐
│ Claude  │ ◄─MCP──►│ MCP Server  │ ◄─HTTP─►│ Backend API  │
│ Desktop │         │ (stdio)     │         │ (REST)       │
└─────────┘         └─────────────┘         └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ PostgreSQL   │
                                            │ Redis        │
                                            │ Solana       │
                                            └──────────────┘
```

## Security Notes

- MCP server runs locally and communicates with backend via HTTP
- ZK proofs ensure payment privacy
- Nullifiers prevent double-spending
- Session tokens expire after 15 minutes
- Content access keys valid for 24 hours
