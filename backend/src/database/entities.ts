import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('content_listings')
@Index(['creator_pubkey'])
@Index(['token_mint'])
export class ContentListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  @Index()
  content_id_hash: string;

  @Column({ type: 'varchar', length: 88 })
  creator_pubkey: string;

  @Column({ type: 'bigint' })
  price_default: string; // Store as string to avoid JS number precision issues

  @Column({ type: 'bigint', nullable: true })
  price_journalist: string | null;

  @Column({ type: 'varchar', length: 88 })
  token_mint: string;

  @Column({ type: 'varchar', length: 88 })
  recipient_pubkey: string;

  @Column({ type: 'jsonb', default: [] })
  credential_policy: string[]; // e.g., ['journalist', 'verified_media']

  @Column({ type: 'text', nullable: true })
  storage_cid: string | null; // IPFS/Arweave CID

  @Column({ type: 'text', nullable: true })
  encryption_key_encrypted: string | null; // Encrypted storage key

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Additional metadata

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('payment_sessions')
@Index(['content_id_hash'])
@Index(['nullifier_hash'], { unique: true })
@Index(['status'])
@Index(['tx_signature'])
export class PaymentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  session_uuid: string;

  @Column({ type: 'varchar', length: 64 })
  content_id_hash: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  payer_hint: string | null; // Optional: IP hash or agent ID

  @Column({ type: 'varchar', length: 64 })
  nullifier_hash: string;

  @Column({ type: 'bigint' })
  amount: string;

  @Column({ type: 'varchar', length: 88, nullable: true })
  tx_signature: string | null;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';

  @Column({ type: 'varchar', length: 20 })
  proof_vkey_version: string; // e.g., 'v1.0.0'

  @Column({ type: 'jsonb', nullable: true })
  proof_data: any; // Store full proof for audit

  @Column({ type: 'jsonb', nullable: true })
  error_details: any;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'bigint', nullable: true })
  slot: string | null;

  @Column({ type: 'bigint', nullable: true })
  block_time: string | null;
}

@Entity('audit_events')
@Index(['session_id'])
@Index(['event_type'])
@Index(['timestamp'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  session_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  event_type: string; // e.g., 'PROOF_VERIFIED', 'PAYMENT_CONFIRMED', 'CONTENT_UNLOCKED'

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'varchar', length: 88, nullable: true })
  actor_pubkey: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}

@Entity('zk_keys')
@Index(['circuit_name', 'version'], { unique: true })
export class ZKKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  circuit_name: string; // 'spend' or 'credential'

  @Column({ type: 'varchar', length: 20 })
  version: string; // e.g., 'v1.0.0'

  @Column({ type: 'text' })
  vkey_json_s3_path: string; // S3 path to verification key

  @Column({ type: 'text', nullable: true })
  zkey_meta: string | null; // Additional metadata

  @Column({ type: 'boolean', default: false })
  active_flag: boolean;

  @CreateDateColumn()
  registered_at: Date;
}

@Entity('credential_issuers')
@Index(['issuer_pubkey'], { unique: true })
export class CredentialIssuer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 88 })
  issuer_pubkey: string;

  @Column({ type: 'varchar', length: 50 })
  credential_type: string; // e.g., 'journalist', 'verified_media'

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Issuer info, contact, etc.

  @CreateDateColumn()
  registered_at: Date;
}

@Entity('merkle_roots')
@Index(['pool_id', 'version'], { unique: true })
export class MerkleRoot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 88 })
  pool_id: string; // Shielded pool program address

  @Column({ type: 'varchar', length: 64 })
  root_hex: string; // Merkle root as hex

  @Column({ type: 'bigint' })
  version: string; // Incrementing version number

  @CreateDateColumn()
  created_at: Date;
}

@Entity('cross_chain_transactions')
@Index(['vaa_hash'], { unique: true })
@Index(['source_tx_hash'])
@Index(['status'])
export class CrossChainTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  source_chain: string; // 'ethereum', 'base', 'arbitrum'

  @Column({ type: 'varchar', length: 132 })
  source_tx_hash: string;

  @Column({ type: 'varchar', length: 132, nullable: true })
  solana_tx_signature: string | null;

  @Column({ type: 'varchar', length: 64 })
  vaa_hash: string;

  @Column({ type: 'text', nullable: true })
  vaa_data: string | null; // Base64 encoded VAA

  @Column({ type: 'uuid', nullable: true })
  payment_session_id: string | null;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'VAA_SIGNED', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'VAA_SIGNED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'jsonb', nullable: true })
  error_details: any;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;
}