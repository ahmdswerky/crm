import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('payment_event_outbox')
@Index(['publishedAt', 'claimedAt'])
export class PaymentEventOutbox {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Index({ unique: true })
  @Column({ name: 'command_message_id', type: 'uuid' })
  commandMessageId!: string;

  @Index()
  @Column({ name: 'correlation_id', type: 'uuid' })
  correlationId!: string;

  @Column({ length: 120 })
  type!: string;

  @Column({ type: 'smallint' })
  version!: number;

  @Column({ length: 120 })
  source!: string;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt!: Date;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt!: Date | null;

  @Column({ name: 'claim_token', type: 'uuid', nullable: true })
  claimToken!: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt!: Date;
}
