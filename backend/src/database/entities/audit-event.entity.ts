import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PaymentSession } from './payment-session.entity';

export enum AuditEventType {
  SESSION_CREATED = 'SESSION_CREATED',
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PROOF_VERIFIED = 'PROOF_VERIFIED',
  NULLIFIER_CHECKED = 'NULLIFIER_CHECKED',
  TX_SUBMITTED = 'TX_SUBMITTED',
  TX_CONFIRMED = 'TX_CONFIRMED',
  TX_FAILED = 'TX_FAILED',
  CONTENT_ACCESSED = 'CONTENT_ACCESSED',
  KEY_DELIVERED = 'KEY_DELIVERED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
}

@Entity('audit_events')
@Index(['sessionId'])
@Index(['eventType'])
@Index(['createdAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId: string | null;

  @Column({ type: 'enum', enum: AuditEventType, name: 'event_type' })
  eventType: AuditEventType;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => PaymentSession, session => session.auditEvents, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: PaymentSession | null;
}
