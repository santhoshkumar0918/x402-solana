import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('merkle_roots')
@Index(['root'], { unique: true })
@Index(['active'])
@Index(['blockNumber'])
export class MerkleRoot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bytea', unique: true })
  root: Buffer;

  @Column({ type: 'bigint', name: 'block_number' })
  blockNumber: string;

  @Column({ type: 'text', name: 'tx_signature' })
  txSignature: string;

  @Column({ type: 'int', name: 'leaf_count' })
  leafCount: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
