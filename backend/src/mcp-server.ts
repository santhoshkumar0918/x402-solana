#!/usr/bin/env node
/**
 * x402 MCP Server
 * Exposes privacy-preserving payment APIs to AI agents via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';

interface PaymentQuote {
  contentId: string;
  price: string;
  tokenMint: string;
  sessionUuid: string;
  expiresAt: number;
}

interface PaymentResult {
  success: boolean;
  txSignature?: string;
  decryptionKey?: string;
  error?: string;
}

interface PaymentStatus {
  sessionUuid: string;
  status: string;
  amount: string | null;
  txSignature: string | null;
  createdAt: string;
  confirmedAt: string | null;
  hasAccess: boolean;
  contentId: string;
}

class X402MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'x402-payment-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_payment_quote',
          description: 'Get a payment quote for premium content. Returns pricing, session ID, and expiration time.',
          inputSchema: {
            type: 'object',
            properties: {
              contentIdHash: {
                type: 'string',
                description: 'SHA256 hash of the content ID (hex encoded)',
              },
              hasJournalistCredential: {
                type: 'boolean',
                description: 'Whether the payer has journalist credentials (for discounted pricing)',
                default: false,
              },
            },
            required: ['contentIdHash'],
          },
        },
        {
          name: 'submit_payment',
          description: 'Submit a payment with ZK proof to access content. Returns decryption key on success.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionUuid: {
                type: 'string',
                description: 'Session UUID from payment quote',
              },
              nullifierHash: {
                type: 'string',
                description: 'Nullifier hash (hex encoded) - prevents double-spending',
              },
              amount: {
                type: 'string',
                description: 'Payment amount in lamports',
              },
              proof: {
                type: 'object',
                description: 'ZK proof object (Groth16 format)',
                properties: {
                  pi_a: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  pi_b: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  pi_c: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
              publicSignals: {
                type: 'array',
                items: { type: 'string' },
                description: 'Public signals for proof verification',
              },
              txSignature: {
                type: 'string',
                description: 'Solana transaction signature (optional)',
              },
            },
            required: ['sessionUuid', 'nullifierHash', 'amount', 'proof', 'publicSignals'],
          },
        },
        {
          name: 'check_payment_status',
          description: 'Check the status of a payment session. Returns payment state and access status.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionUuid: {
                type: 'string',
                description: 'Session UUID to check',
              },
            },
            required: ['sessionUuid'],
          },
        },
        {
          name: 'get_content_metadata',
          description: 'Get metadata for a content item including pricing and storage details.',
          inputSchema: {
            type: 'object',
            properties: {
              contentId: {
                type: 'string',
                description: 'Content UUID',
              },
            },
            required: ['contentId'],
          },
        },
        {
          name: 'pay_and_fetch',
          description: 'Complete payment flow: get quote, submit payment, and retrieve decryption key in one call.',
          inputSchema: {
            type: 'object',
            properties: {
              contentIdHash: {
                type: 'string',
                description: 'SHA256 hash of the content ID (hex encoded)',
              },
              hasJournalistCredential: {
                type: 'boolean',
                description: 'Whether the payer has journalist credentials',
                default: false,
              },
              nullifierHash: {
                type: 'string',
                description: 'Nullifier hash (hex encoded) for this payment',
              },
              proof: {
                type: 'object',
                description: 'ZK proof object',
              },
              publicSignals: {
                type: 'array',
                items: { type: 'string' },
              },
              txSignature: {
                type: 'string',
                description: 'Solana transaction signature (optional)',
              },
            },
            required: ['contentIdHash', 'nullifierHash', 'proof', 'publicSignals'],
          },
        },
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_payment_quote':
            return await this.getPaymentQuote(args);
          
          case 'submit_payment':
            return await this.submitPayment(args);
          
          case 'check_payment_status':
            return await this.checkPaymentStatus(args);
          
          case 'get_content_metadata':
            return await this.getContentMetadata(args);
          
          case 'pay_and_fetch':
            return await this.payAndFetch(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                details: error.response?.data || error.stack,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async getPaymentQuote(args: any) {
    const response = await axios.post<PaymentQuote>(`${API_BASE}/quote`, {
      contentIdHash: args.contentIdHash,
      hasJournalistCredential: args.hasJournalistCredential || false,
    });

    const quote = response.data;
    const priceInSol = (parseInt(quote.price) / 1e9).toFixed(6);
    const expiresIn = Math.floor((quote.expiresAt - Date.now()) / 1000 / 60);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            quote: {
              sessionUuid: quote.sessionUuid,
              contentId: quote.contentId,
              price: quote.price,
              priceInSol: `${priceInSol} SOL`,
              tokenMint: quote.tokenMint,
              expiresAt: new Date(quote.expiresAt).toISOString(),
              expiresInMinutes: expiresIn,
            },
            message: `Payment quote generated. Session expires in ${expiresIn} minutes.`,
          }, null, 2),
        },
      ],
    };
  }

  private async submitPayment(args: any) {
    const response = await axios.post<PaymentResult>(`${API_BASE}/pay`, {
      sessionUuid: args.sessionUuid,
      nullifierHash: args.nullifierHash,
      amount: args.amount,
      proof: args.proof,
      publicSignals: args.publicSignals,
      txSignature: args.txSignature,
    });

    const result = response.data;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            payment: {
              txSignature: result.txSignature,
              decryptionKey: result.decryptionKey,
            },
            message: result.success
              ? 'Payment confirmed! Content access granted.'
              : 'Payment failed.',
          }, null, 2),
        },
      ],
    };
  }

  private async checkPaymentStatus(args: any) {
    const response = await axios.get<PaymentStatus>(
      `${API_BASE}/status/${args.sessionUuid}`
    );

    const status = response.data;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            status: {
              sessionUuid: status.sessionUuid,
              paymentStatus: status.status,
              amount: status.amount,
              amountInSol: status.amount ? `${(parseInt(status.amount) / 1e9).toFixed(6)} SOL` : null,
              hasAccess: status.hasAccess,
              txSignature: status.txSignature,
              createdAt: status.createdAt,
              confirmedAt: status.confirmedAt,
              contentId: status.contentId,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async getContentMetadata(args: any) {
    const response = await axios.get(`${API_BASE}/content/${args.contentId}`);
    const content = response.data;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            content: {
              id: content.id,
              contentIdHash: content.contentIdHash,
              creatorPubkey: content.creatorPubkey,
              pricing: {
                default: content.priceDefault,
                defaultInSol: `${(parseInt(content.priceDefault) / 1e9).toFixed(6)} SOL`,
                journalist: content.priceJournalist,
                journalistInSol: content.priceJournalist
                  ? `${(parseInt(content.priceJournalist) / 1e9).toFixed(6)} SOL`
                  : null,
              },
              tokenMint: content.tokenMint,
              credentialPolicy: content.credentialPolicy,
              storageCid: content.storageCid,
              metadata: content.metadata,
              createdAt: content.createdAt,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async payAndFetch(args: any) {
    // Step 1: Get quote
    const quoteResponse = await axios.post<PaymentQuote>(`${API_BASE}/quote`, {
      contentIdHash: args.contentIdHash,
      hasJournalistCredential: args.hasJournalistCredential || false,
    });

    const quote = quoteResponse.data;

    // Step 2: Submit payment
    const paymentResponse = await axios.post<PaymentResult>(`${API_BASE}/pay`, {
      sessionUuid: quote.sessionUuid,
      nullifierHash: args.nullifierHash,
      amount: quote.price,
      proof: args.proof,
      publicSignals: args.publicSignals,
      txSignature: args.txSignature,
    });

    const payment = paymentResponse.data;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: payment.success,
            transaction: {
              sessionUuid: quote.sessionUuid,
              contentId: quote.contentId,
              price: quote.price,
              priceInSol: `${(parseInt(quote.price) / 1e9).toFixed(6)} SOL`,
              txSignature: payment.txSignature,
              decryptionKey: payment.decryptionKey,
            },
            message: payment.success
              ? '✅ Payment successful! Access granted to premium content.'
              : '❌ Payment failed.',
          }, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('x402 MCP Server running on stdio');
  }
}

// Start server
const server = new X402MCPServer();
server.run().catch(console.error);
