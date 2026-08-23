import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTables20260821120000 implements MigrationInterface {
  name = 'CreatePaymentTables20260821120000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE invoices (
        id SERIAL PRIMARY KEY,
        invoicable_type VARCHAR(120) NOT NULL,
        invoicable_id INTEGER NOT NULL,
        type VARCHAR(80) NOT NULL,
        value NUMERIC(12, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT invoices_source_type_id_type_unique UNIQUE (invoicable_type, invoicable_id, type)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE payment_job_receipts (
        message_id UUID PRIMARY KEY,
        correlation_id UUID NOT NULL,
        command_type VARCHAR(120) NOT NULL,
        status VARCHAR(20) NOT NULL,
        payload JSONB NOT NULL,
        result JSONB NULL,
        failure_code VARCHAR(120) NULL,
        failure_message TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX payment_job_receipts_correlation_id_idx ON payment_job_receipts (correlation_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE payment_job_receipts');
    await queryRunner.query('DROP TABLE invoices');
  }
}
