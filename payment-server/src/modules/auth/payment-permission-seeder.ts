import { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';
import { CRM_PERMISSION_GUARD } from './auth.constants';
import { paymentPermissionNames } from './payment-permissions';

const DEFAULT_ROLE_NAMES = ['manager', 'agent'];

async function queryRows<T>(
  queryRunner: QueryRunner,
  sql: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  const result: unknown = await queryRunner.query(sql, parameters);

  if (!Array.isArray(result)) {
    throw new Error('Auth seeder query returned an invalid result');
  }

  return result as T[];
}

export function authDataSourceOptions(): DataSourceOptions {
  return {
    name: 'auth-seed',
    type: 'postgres',
    host: process.env.PAYMENTS_AUTH_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.PAYMENTS_AUTH_DB_PORT ?? 5432),
    username: process.env.PAYMENTS_AUTH_DB_USER ?? 'auth_seeder',
    password: process.env.PAYMENTS_AUTH_DB_PASSWORD,
    database: process.env.PAYMENTS_AUTH_DB_NAME ?? 'crm',
    synchronize: false,
    connectTimeoutMS: 1000,
  };
}

function configuredRoleNames(): string[] {
  const value = process.env.PAYMENTS_AUTH_SEED_ROLE_NAMES;

  if (!value) {
    return DEFAULT_ROLE_NAMES;
  }

  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error('PAYMENTS_AUTH_SEED_ROLE_NAMES must contain a role');
  }

  return [...new Set(names)];
}

async function permissionId(
  queryRunner: QueryRunner,
  name: string,
): Promise<number> {
  const existing = await queryRows<{ id: string | number }>(
    queryRunner,
    'SELECT id FROM permissions WHERE name = $1 ORDER BY id LIMIT 1',
    [name],
  );

  if (existing[0]?.id) {
    return Number(existing[0].id);
  }

  const inserted = await queryRows<{ id: string | number }>(
    queryRunner,
    `
      INSERT INTO permissions (name, guard_name, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (name, guard_name) DO NOTHING
      RETURNING id
    `,
    [name, CRM_PERMISSION_GUARD],
  );

  if (inserted[0]?.id) {
    return Number(inserted[0].id);
  }

  const insertedByAnotherProcess = await queryRows<{ id: string | number }>(
    queryRunner,
    'SELECT id FROM permissions WHERE name = $1 ORDER BY id LIMIT 1',
    [name],
  );

  if (!insertedByAnotherProcess[0]?.id) {
    throw new Error(`Unable to resolve permission: ${name}`);
  }

  return Number(insertedByAnotherProcess[0].id);
}

export async function seedPaymentPermissions(
  dataSource = new DataSource(authDataSourceOptions()),
): Promise<void> {
  const roleNames = configuredRoleNames();
  const permissionNames = paymentPermissionNames();
  const ownsDataSource = !dataSource.isInitialized;

  if (ownsDataSource) {
    await dataSource.initialize();
  }

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const roles = await queryRows<{ id: string | number; name: string }>(
      queryRunner,
      `
        SELECT id, name
        FROM roles
        WHERE name = ANY($1::text[])
      `,
      [roleNames],
    );
    const roleMap = new Map<string, number[]>();

    for (const role of roles) {
      const roleIds = roleMap.get(role.name) ?? [];
      roleIds.push(Number(role.id));
      roleMap.set(role.name, roleIds);
    }

    const missingRoles = roleNames.filter((name) => !roleMap.has(name));

    if (missingRoles.length > 0) {
      throw new Error(
        `CRM roles must be seeded before payment permissions: ${missingRoles.join(', ')}`,
      );
    }

    for (const name of permissionNames) {
      const id = await permissionId(queryRunner, name);

      for (const roleName of roleNames) {
        for (const roleId of roleMap.get(roleName) ?? []) {
          await queryRows<unknown>(
            queryRunner,
            `
              INSERT INTO role_has_permissions (permission_id, role_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `,
            [id, roleId],
          );
        }
      }
    }

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();

    if (ownsDataSource) {
      await dataSource.destroy();
    }
  }
}
