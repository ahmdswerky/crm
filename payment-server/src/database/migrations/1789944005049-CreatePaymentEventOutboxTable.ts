import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { TableIndex } from 'typeorm/browser';

export class CreatePaymentEventOutboxTable1789944005049 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_event_outbox',
        columns: [
          {
            name: 'event_id',
            type: 'uuid',
            isGenerated: true,
            isPrimary: true,
          },
          {
            name: 'command_message_id',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'correlation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'smallint',
            isNullable: false,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'occurred_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'published_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'attempts',
            type: 'int',
            unsigned: true,
            default: 0,
            isNullable: false,
          },
          {
            name: 'last_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'claimed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'claim_token',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'payment_event_outbox',
      new TableIndex({
        columnNames: ['correlation_id'],
      }),
    );

    await queryRunner.createIndex(
      'payment_event_outbox',
      new TableIndex({
        columnNames: ['published_at', 'claimed_at'],
      }),
    );

    // await queryRunner.query(`
    //     CREATE TABLE payment_event_outbox (
    //       event_id UUID PRIMARY KEY,
    //       command_message_id UUID NOT NULL UNIQUE,
    //       correlation_id UUID NOT NULL,
    //       type VARCHAR(120) NOT NULL,
    //       version SMALLINT NOT NULL,
    //       source VARCHAR(120) NOT NULL,
    //       occurred_at TIMESTAMP NOT NULL,
    //       payload JSONB NOT NULL,
    //       published_at TIMESTAMP NULL,
    //       attempts INTEGER NOT NULL DEFAULT 0,
    //       last_error TEXT NULL,
    //       claimed_at TIMESTAMP NULL,
    //       claim_token UUID NULL,ack
    //       created_at TIMESTAMP NOT NULL DEFAULT now(),
    //       updated_at TIMESTAMP NOT NULL DEFAULT now()
    //     )
    //   `);
    // await queryRunner.query(
    //   'CREATE INDEX payment_event_outbox_correlation_id_idx ON payment_event_outbox (correlation_id)',
    // );
    // await queryRunner.query(
    //   'CREATE INDEX payment_event_outbox_ready_idx ON payment_event_outbox (published_at, claimed_at)',
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_event_outbox');
  }
}
