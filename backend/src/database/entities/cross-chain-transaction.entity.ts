import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum CrossChainStatus {
  INITIATED = 'INITIATED',
  VAA_SIGNED = 'VAA_SIGNED',
  RELAYED = 'RELAYED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

@Entity('cross_chain_transactions')
@Index(['sourceChain', 'sourceTx'], { unique: true })
@Index(['vaaHash'])
@Index(['status'])
export class CrossChainTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', name: 'source_chain' })
  sourceChain: string;

  @Column({ type: 'text', name: 'source_tx' })
  sourceTx: string;

  @Column({ type: 'text', name: 'destination_chain' })
  destinationChain: string;

  @Column({ type: 'text', name: 'destination_tx', nullable: true })
  destinationTx: string | null;

  @Column({ type: 'text', name: 'vaa_hash', nullable: true })
  vaaHash: string | null;

  @Column({ type: 'jsonb', name: 'vaa_payload', nullable: true })
  vaaPayload: Record<string, any> | null;

  @Column({ type: 'enum', enum: CrossChainStatus, default: CrossChainStatus.INITIATED })
  status: CrossChainStatus;

  @Column({ type: 'bigint', nullable: true })
  amount: string | null;

  @Column({ type: 'text', name: 'sender_address' })
  senderAddress: string;

  @Column({ type: 'text', name: 'recipient_address' })
  recipientAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'confirmed_at', nullable: true })
  confirmedAt: Date | null;
}
