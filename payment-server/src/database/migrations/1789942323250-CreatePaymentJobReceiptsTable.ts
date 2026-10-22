import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { TableIndex } from 'typeorm/browser';

export class CreatePaymentJobReceiptsTable1789942323250 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_job_receipts',
        columns: [
          {
            name: 'message_id',
            type: 'uuid',
            isGenerated: true,
            isPrimary: true,
          },
          {
            name: 'correlation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'command_type',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'failure_code',
            type: 'varchar',
            length: '120',
            isNullable: true,
          },
          {
            name: 'failure_message',
            type: 'varchar',
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
      'payment_job_receipts',
      new TableIndex({
        columnNames: ['correlation_id'],
      }),
    );

    // await queryRunner.query(`
    //   CREATE TABLE payment_job_receipts (
    //     message_id UUID PRIMARY KEY,
    //     correlation_id UUID NOT NULL,
    //     command_type VARCHAR(120) NOT NULL,
    //     status VARCHAR(20) NOT NULL,
    //     payload JSONB NOT NULL,
    //     result JSONB NULL,
    //     failure_code VARCHAR(120) NULL,
    //     failure_message TEXT NULL,
    //     created_at TIMESTAMP NOT NULL DEFAULT now(),
    //     updated_at TIMESTAMP NOT NULL DEFAULT now()
    //   )
    // `);
    // await queryRunner.query(
    //   'CREATE INDEX payment_job_receipts_correlation_id_idx ON payment_job_receipts (correlation_id)',
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_job_receipts');
  }
}
