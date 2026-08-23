import { Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CrmUserService } from '../user/user.service';
import { CRM_TOKENABLE_TYPE } from './auth.constants';
import { CrmAuthUser } from './auth.types';
import {
  ModelHasPermissionEntity,
  ModelHasRoleEntity,
  PermissionEntity,
  PersonalAccessTokenEntity,
  RoleEntity,
  RoleHasPermissionEntity,
} from './entities';

export class AuthDatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('CRM auth database is unavailable', { cause });
    this.name = 'AuthDatabaseUnavailableError';
  }
}

export interface SanctumTokenParts {
  readonly id: number;
  readonly value: string;
}

export function parseSanctumToken(token: string): SanctumTokenParts | null {
  const separator = token.indexOf('|');

  if (separator <= 0 || separator === token.length - 1) {
    return null;
  }

  const idValue = token.slice(0, separator);
  const id = Number(idValue);

  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return { id, value: token.slice(separator + 1) };
}

@Injectable()
export class CrmAuthRepository {
  constructor(
    private readonly userService: CrmUserService,
    @Optional()
    @InjectDataSource('auth')
    private readonly dataSource?: DataSource,
  ) {}

  async findByBearerToken(token: string): Promise<CrmAuthUser | null> {
    const parts = parseSanctumToken(token);

    if (!parts) {
      return null;
    }

    const tokenHash = createHash('sha256').update(parts.value).digest('hex');

    try {
      if (!this.dataSource) {
        throw new AuthDatabaseUnavailableError();
      }

      const token = await this.dataSource
        .getRepository(PersonalAccessTokenEntity)
        .createQueryBuilder('token')
        .where('token.id = :id', { id: String(parts.id) })
        .andWhere('token.token = :token', { token: tokenHash })
        .andWhere('token.tokenable_type = :tokenableType', {
          tokenableType: CRM_TOKENABLE_TYPE,
        })
        .andWhere(
          '(token.expires_at IS NULL OR token.expires_at > CURRENT_TIMESTAMP)',
        )
        .getOne();

      if (!token) {
        return null;
      }

      const user = await this.userService.findActiveById(token.tokenableId);

      if (!user) {
        return null;
      }

      const userId = Number(user.id);
      const isSuper = Boolean(user.isSuper);

      if (isSuper) {
        return {
          id: userId,
          isSuper: true,
          roles: [],
          permissions: new Set(),
        };
      }

      const [roleRows, permissionRows] = await Promise.all([
        this.dataSource
          .getRepository(RoleEntity)
          .createQueryBuilder('role')
          .innerJoin(
            ModelHasRoleEntity,
            'assignment',
            'assignment.role_id = role.id',
          )
          .where('assignment.model_id = :modelId', { modelId: user.id })
          .andWhere('assignment.model_type = :modelType', {
            modelType: CRM_TOKENABLE_TYPE,
          })
          .select('role.name', 'name')
          .distinct(true)
          .getRawMany<{ name: string }>(),
        this.dataSource
          .getRepository(PermissionEntity)
          .createQueryBuilder('permission')
          .leftJoin(
            ModelHasPermissionEntity,
            'direct',
            'direct.permission_id = permission.id AND direct.model_id = :modelId AND direct.model_type = :modelType',
          )
          .leftJoin(
            ModelHasRoleEntity,
            'assignment',
            'assignment.model_id = :modelId AND assignment.model_type = :modelType',
          )
          .leftJoin(
            RoleHasPermissionEntity,
            'rolePermission',
            'rolePermission.role_id = assignment.role_id AND rolePermission.permission_id = permission.id',
          )
          .leftJoin(RoleEntity, 'role', 'role.id = rolePermission.role_id')
          .where(
            '(direct.permission_id IS NOT NULL OR (rolePermission.permission_id IS NOT NULL AND role.id IS NOT NULL))',
          )
          .select('permission.name', 'name')
          .distinct(true)
          .getRawMany<{ name: string }>(),
      ]);

      return {
        id: userId,
        isSuper,
        roles: roleRows.map((row) => row.name),
        permissions: new Set(permissionRows.map((row) => row.name)),
      };
    } catch (error) {
      throw new AuthDatabaseUnavailableError(error);
    }
  }

  async ping(): Promise<void> {
    if (!this.dataSource) {
      throw new AuthDatabaseUnavailableError();
    }

    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      throw new AuthDatabaseUnavailableError(error);
    }
  }
}
