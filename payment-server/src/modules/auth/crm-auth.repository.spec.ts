import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CRM_TOKENABLE_TYPE } from './auth.constants';
import { CrmAuthRepository, parseSanctumToken } from './crm-auth.repository';
import { CrmUserService } from '../user/user.service';
import {
  ModelHasPermissionEntity,
  ModelHasRoleEntity,
  PermissionEntity,
  PersonalAccessTokenEntity,
  RoleEntity,
} from './entities';
import { UserEntity } from '../user/entities/user.entity';

describe('parseSanctumToken', () => {
  it('accepts Laravel Sanctum numeric id tokens', () => {
    expect(parseSanctumToken('42|plain-text')).toEqual({
      id: 42,
      value: 'plain-text',
    });
  });

  it.each(['', '42', '0|token', 'not-a-number|token', '42|'])(
    'rejects malformed token %j',
    (token) => {
      expect(parseSanctumToken(token)).toBeNull();
    },
  );
});

function queryBuilder<T>(one?: T, many: unknown[] = []) {
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(one),
    getRawMany: jest.fn().mockResolvedValue(many),
  };

  return builder;
}

function repository(builder: ReturnType<typeof queryBuilder>) {
  return { createQueryBuilder: jest.fn().mockReturnValue(builder) };
}

describe('CrmAuthRepository', () => {
  it('loads the user, roles, direct permissions, and role permissions', async () => {
    const tokenQuery = queryBuilder({
      tokenableId: '7',
      tokenableType: CRM_TOKENABLE_TYPE,
    });
    const roleQuery = queryBuilder(undefined, [{ name: 'manager' }]);
    const permissionQuery = queryBuilder(undefined, [
      { name: 'invoice.view' },
      { name: 'payment.create' },
    ]);
    const repositories = new Map<unknown, unknown>([
      [PersonalAccessTokenEntity, repository(tokenQuery)],
      [RoleEntity, repository(roleQuery)],
      [PermissionEntity, repository(permissionQuery)],
      [ModelHasRoleEntity, {}],
      [ModelHasPermissionEntity, {}],
    ]);
    const dataSource = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    } as unknown as DataSource;
    const userService = {
      findActiveById: jest.fn().mockResolvedValue({
        id: '7',
        isSuper: false,
      } satisfies Partial<UserEntity>),
    };
    const authRepository = new CrmAuthRepository(
      userService as unknown as CrmUserService,
      dataSource,
    );

    await expect(
      authRepository.findByBearerToken('42|plain-text'),
    ).resolves.toEqual({
      id: 7,
      isSuper: false,
      roles: ['manager'],
      permissions: new Set(['invoice.view', 'payment.create']),
    });

    expect(tokenQuery.andWhere).toHaveBeenCalledWith('token.token = :token', {
      token: createHash('sha256').update('plain-text').digest('hex'),
    });
    expect(userService.findActiveById).toHaveBeenCalledWith('7');
    expect(roleQuery.andWhere).toHaveBeenCalledWith(
      'assignment.model_type = :modelType',
      { modelType: CRM_TOKENABLE_TYPE },
    );
    expect(
      permissionQuery.where.mock.calls.some(([condition]) =>
        String(condition).includes('guard_name'),
      ),
    ).toBe(false);
  });

  it('does not query the database for malformed tokens', async () => {
    const getRepository = jest.fn();
    const userService = { findActiveById: jest.fn() };
    const repository = new CrmAuthRepository(
      userService as unknown as CrmUserService,
      { getRepository } as unknown as DataSource,
    );

    await expect(repository.findByBearerToken('bad-token')).resolves.toBeNull();
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('returns null when the token or user is not valid', async () => {
    const tokenQuery = queryBuilder();
    const getRepository = jest.fn().mockReturnValue(repository(tokenQuery));
    const userService = { findActiveById: jest.fn() };
    const authRepository = new CrmAuthRepository(
      userService as unknown as CrmUserService,
      { getRepository } as unknown as DataSource,
    );

    await expect(
      authRepository.findByBearerToken('42|plain-text'),
    ).resolves.toBeNull();
    expect(userService.findActiveById).not.toHaveBeenCalled();
  });

  it('does not query roles or permissions for a super user', async () => {
    const tokenQuery = queryBuilder({ tokenableId: '7' });
    const getRepository = jest.fn().mockReturnValue(repository(tokenQuery));
    const userService = {
      findActiveById: jest.fn().mockResolvedValue({ id: '7', isSuper: true }),
    };
    const authRepository = new CrmAuthRepository(
      userService as unknown as CrmUserService,
      { getRepository } as unknown as DataSource,
    );

    await expect(
      authRepository.findByBearerToken('42|plain-text'),
    ).resolves.toEqual({
      id: 7,
      isSuper: true,
      roles: [],
      permissions: new Set(),
    });
    expect(getRepository).toHaveBeenCalledTimes(1);
  });
});
