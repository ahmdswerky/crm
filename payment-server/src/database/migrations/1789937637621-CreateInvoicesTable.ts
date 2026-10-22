import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateInvoicesTable1789937637621 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isGenerated: true,
            unsigned: true,
            isPrimary: true,
          },
          {
            name: 'invoicable_type',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'invoicable_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'value',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'completed'",
            isNullable: false,
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
      true,
    );

    // await queryRunner.createUniqueConstraint('invoices', {
    //   columnNames: ['invoicable_type', 'invoicable_id', 'type'],
    // })

    // await queryRunner.query(`
    //   CREATE TABLE invoices (
    //     id SERIAL PRIMARY KEY,
    //     invoicable_type VARCHAR(120) NOT NULL,
    //     invoicable_id INTEGER NOT NULL,
    //     type VARCHAR(80) NOT NULL,
    //     value NUMERIC(12, 2) NOT NULL,
    //     status VARCHAR(20) NOT NULL DEFAULT 'completed',
    //     created_at TIMESTAMP NOT NULL DEFAULT now(),
    //     updated_at TIMESTAMP NOT NULL DEFAULT now(),
    //     CONSTRAINT invoices_source_type_id_type_unique UNIQUE (invoicable_type, invoicable_id, type)
    //   )
    // `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('invoices');
  }
}
