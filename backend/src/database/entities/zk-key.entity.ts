import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum CircuitType {
  SPEND = 'spend',
  CREDENTIAL = 'credential',
  MERKLETREE = 'merkletree',
}

@Entity('zk_keys')
@Index(['circuitName', 'version'], { unique: true })
@Index(['active'])
export class ZKKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: CircuitType, name: 'circuit_name' })
  circuitName: CircuitType;

  @Column({ type: 'text' })
  version: string;

  @Column({ type: 'text', name: 'vkey_path', nullable: true })
  vkeyPath: string | null;

  @Column({ type: 'text', name: 'zkey_path', nullable: true })
  zkeyPath: string | null;

  @Column({ type: 'text', name: 'wasm_path', nullable: true })
  wasmPath: string | null;

  @Column({ type: 'jsonb', name: 'vkey_data' })
  vkeyData: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
