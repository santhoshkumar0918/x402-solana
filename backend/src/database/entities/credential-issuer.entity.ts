import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('credential_issuers')
@Index(['issuerPubkey'], { unique: true })
@Index(['active'])
export class CredentialIssuer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', name: 'issuer_pubkey', unique: true })
  issuerPubkey: string;

  @Column({ type: 'text', name: 'issuer_name' })
  issuerName: string;

  @Column({ type: 'text', name: 'credential_type' })
  credentialType: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
