import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('payment_job_receipts')
export class PaymentJobReceipt {
  @PrimaryColumn({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @Index()
  @Column({ name: 'correlation_id', type: 'uuid' })
  correlationId!: string;

  @Column({ name: 'command_type', length: 120 })
  commandType!: string;

  @Column({ length: 20 })
  status!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  result!: Record<string, unknown> | null;

  @Column({
    name: 'failure_code',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  failureCode!: string | null;

  @Column({ name: 'failure_message', type: 'text', nullable: true })
  failureMessage!: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt!: Date;
}
