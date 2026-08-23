import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('invoices')
@Index(['invoicableType', 'invoicableId', 'type'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'invoicable_type', length: 120 })
  invoicableType!: string;

  @Column({ name: 'invoicable_id', type: 'integer' })
  invoicableId!: number;

  @Column({ length: 80 })
  type!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  value!: string;

  @Column({ length: 20, default: 'completed' })
  status!: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt!: Date;
}
