import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentEventOutbox20260825000000 implements MigrationInterface {
  name = 'CreatePaymentEventOutbox20260825000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_event_outbox (
        event_id UUID PRIMARY KEY,
        command_message_id UUID NOT NULL UNIQUE,
        correlation_id UUID NOT NULL,
        type VARCHAR(120) NOT NULL,
        version SMALLINT NOT NULL,
        source VARCHAR(120) NOT NULL,
        occurred_at TIMESTAMP NOT NULL,
        payload JSONB NOT NULL,
        published_at TIMESTAMP NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        claimed_at TIMESTAMP NULL,
        claim_token UUID NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX payment_event_outbox_correlation_id_idx ON payment_event_outbox (correlation_id)',
    );
    await queryRunner.query(
      'CREATE INDEX payment_event_outbox_ready_idx ON payment_event_outbox (published_at, claimed_at)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE payment_event_outbox');
  }
}
