import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * CrossChainPayment Entity
 * Tracks cross-chain payment intents received via Wormhole VAAs
 */
@Entity('cross_chain_payments')
@Index('idx_vaa_hash', ['vaaHash'], { unique: true })
@Index('idx_emitter_address', ['emitterAddress'])
@Index('idx_session_id', ['sessionId'])
@Index('idx_processed_at', ['processedAt'])
export class CrossChainPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique hash of the VAA (for idempotency)
   * Prevents replay attacks and duplicate processing
   */
  @Column({ name: 'vaa_hash', type: 'varchar', length: 66, unique: true })
  vaaHash: string;

  /**
   * Wormhole chain ID of the emitter (e.g., 30 for Base, 2 for Ethereum)
   */
  @Column({ name: 'emitter_chain', type: 'smallint' })
  emitterChain: number;

  /**
   * Contract address that emitted the message (X402PaymentEmitter)
   * Used for whitelist validation
   */
  @Column({ name: 'emitter_address', type: 'varchar', length: 66 })
  emitterAddress: string;

  /**
   * Wormhole message sequence number
   */
  @Column({ name: 'sequence', type: 'bigint' })
  sequence: string;

  /**
   * Hash of the decoded payload (for integrity verification)
   */
  @Column({ name: 'payload_hash', type: 'varchar', length: 66 })
  payloadHash: string;

  /**
   * Decoded payload data (JSON)
   * Contains: contentId, sessionId, externalNullifier, payer, amount, timestamp
   */
  @Column({ name: 'payload_data', type: 'jsonb' })
  payloadData: {
    contentId: string;
    sessionId: string;
    externalNullifier: string;
    payer: string;
    amount: string;
    timestamp: number;
  };

  /**
   * Session UUID from backend (links to payment_sessions table)
   */
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  /**
   * Content ID from x402 system
   */
  @Column({ name: 'content_id', type: 'varchar', length: 66 })
  contentId: string;

  /**
   * Payer address on source chain
   */
  @Column({ name: 'payer_address', type: 'varchar', length: 42 })
  payerAddress: string;

  /**
   * Payment amount (USDC, 6 decimals)
   */
  @Column({ name: 'amount', type: 'bigint' })
  amount: string;

  /**
   * Timestamp when VAA was processed by backend
   */
  @Column({ name: 'processed_at', type: 'timestamp with time zone' })
  processedAt: Date;

  /**
   * Guardian signatures count (should be >= 13 for testnet)
   */
  @Column({ name: 'guardian_signatures', type: 'smallint' })
  guardianSignatures: number;

  /**
   * Status: PENDING, VERIFIED, FAILED
   */
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  /**
   * Error message if verification failed
   */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
