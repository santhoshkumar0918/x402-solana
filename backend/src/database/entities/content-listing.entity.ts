import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, OneToMany } from 'typeorm';
import { PaymentSession } from './payment-session.entity';

@Entity('content_listings')
@Index(['contentIdHash'], { unique: true })
@Index(['creatorPubkey'])
export class ContentListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bytea', name: 'content_id_hash' })
  contentIdHash: Buffer;

  @Column({ type: 'text', name: 'creator_pubkey' })
  creatorPubkey: string;

  @Column({ type: 'bigint', name: 'price_default' })
  priceDefault: string;

  @Column({ type: 'bigint', name: 'price_journalist', nullable: true })
  priceJournalist: string | null;

  @Column({ type: 'text', name: 'token_mint' })
  tokenMint: string;

  @Column({ type: 'text', name: 'recipient_pubkey' })
  recipientPubkey: string;

  @Column({ type: 'smallint', name: 'credential_policy' })
  credentialPolicy: number;

  @Column({ type: 'text', name: 'storage_cid', nullable: true })
  storageCid: string | null;

  @Column({ type: 'text', name: 'encryption_key_hash', nullable: true })
  encryptionKeyHash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => PaymentSession, session => session.content)
  paymentSessions: PaymentSession[];
}
