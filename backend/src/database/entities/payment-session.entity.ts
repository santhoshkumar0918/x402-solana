import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ContentListing } from './content-listing.entity';
import { AuditEvent } from './audit-event.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity('payment_sessions')
@Index(['sessionUuid'], { unique: true })
@Index(['nullifierHash'], { unique: true, where: 'nullifier_hash IS NOT NULL' })
@Index(['txSignature'])
@Index(['status'])
@Index(['createdAt'])
export class PaymentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'content_id' })
  contentId: string;

  @Column({ type: 'text', name: 'session_uuid', unique: true })
  sessionUuid: string;

  @Column({ type: 'text', name: 'payer_hint', nullable: true })
  payerHint: string | null;

  @Column({ type: 'bytea', name: 'nullifier_hash', nullable: true })
  nullifierHash: Buffer | null;

  @Column({ type: 'bigint', nullable: true })
  amount: string | null;

  @Column({ type: 'text', name: 'tx_signature', nullable: true })
  txSignature: string | null;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'confirmed_at', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'text', name: 'proof_vkey_version', nullable: true })
  proofVkeyVersion: string | null;

  @Column({ type: 'text', name: 'decryption_key_encrypted', nullable: true })
  decryptionKeyEncrypted: string | null;

  @Column({ type: 'jsonb', name: 'proof_data', nullable: true })
  proofData: Record<string, any> | null;

  @ManyToOne(() => ContentListing, listing => listing.paymentSessions)
  @JoinColumn({ name: 'content_id' })
  content: ContentListing;

  @OneToMany(() => AuditEvent, event => event.session)
  auditEvents: AuditEvent[];
}
