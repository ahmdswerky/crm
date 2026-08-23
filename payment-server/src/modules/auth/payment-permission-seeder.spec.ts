import { DataSource } from 'typeorm';
import { seedPaymentPermissions } from './payment-permission-seeder';
import { paymentPermissionNames } from './payment-permissions';

describe('seedPaymentPermissions', () => {
  it('adds the payment permission catalog to existing CRM roles idempotently', async () => {
    let permissionId = 0;
    const query = jest.fn<unknown[], [string, unknown[]?]>((sql: string) => {
      if (sql.includes('FROM roles')) {
        return [
          { id: 10, name: 'manager' },
          { id: 11, name: 'manager' },
          { id: 12, name: 'agent' },
        ];
      }

      if (sql.includes('INSERT INTO permissions')) {
        permissionId += 1;
        return [{ id: permissionId }];
      }

      return [];
    });
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query,
    };
    const dataSource = {
      isInitialized: true,
      createQueryRunner: () => queryRunner,
    } as unknown as DataSource;

    await seedPaymentPermissions(dataSource);

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(
      query.mock.calls
        .filter(([sql]) => sql.includes('INSERT INTO permissions'))
        .map(([, parameters]) => parameters[0]),
    ).toEqual(paymentPermissionNames());
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('role_has_permissions')),
    ).toHaveLength(paymentPermissionNames().length * 3);

    const roleQuery = query.mock.calls.find(([sql]) =>
      sql.includes('FROM roles'),
    );
    expect(roleQuery?.[0]).not.toContain('guard_name');
  });

  it('reuses a permission regardless of its guard name', async () => {
    const query = jest.fn<unknown[], [string, unknown[]?]>((sql: string) => {
      if (sql.includes('FROM roles')) {
        return [
          { id: 10, name: 'manager' },
          { id: 11, name: 'agent' },
        ];
      }

      if (sql.includes('SELECT id FROM permissions')) {
        return [{ id: 99 }];
      }

      return [];
    });
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query,
    };
    const dataSource = {
      isInitialized: true,
      createQueryRunner: () => queryRunner,
    } as unknown as DataSource;

    await seedPaymentPermissions(dataSource);

    expect(
      query.mock.calls.some(([sql]) => sql.includes('INSERT INTO permissions')),
    ).toBe(false);
    expect(
      query.mock.calls
        .filter(([sql]) => sql.includes('role_has_permissions'))
        .every(([, parameters]) => parameters?.[0] === 99),
    ).toBe(true);
  });

  it('rolls back when a CRM role has not been seeded', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };
    const dataSource = {
      isInitialized: true,
      createQueryRunner: () => queryRunner,
    } as unknown as DataSource;

    await expect(seedPaymentPermissions(dataSource)).rejects.toThrow(
      'CRM roles must be seeded before payment permissions',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });
});
