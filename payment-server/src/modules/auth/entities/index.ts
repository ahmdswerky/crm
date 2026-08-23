import { UserEntity } from '../../user/entities/user.entity';
import { ModelHasPermissionEntity } from './model-has-permission.entity';
import { ModelHasRoleEntity } from './model-has-role.entity';
import { PermissionEntity } from './permission.entity';
import { PersonalAccessTokenEntity } from './personal-access-token.entity';
import { RoleHasPermissionEntity } from './role-has-permission.entity';
import { RoleEntity } from './role.entity';

export {
  ModelHasPermissionEntity,
  ModelHasRoleEntity,
  PermissionEntity,
  PersonalAccessTokenEntity,
  RoleEntity,
  RoleHasPermissionEntity,
};

export const CRM_AUTH_ENTITIES = [
  UserEntity,
  RoleEntity,
  PermissionEntity,
  PersonalAccessTokenEntity,
  ModelHasRoleEntity,
  ModelHasPermissionEntity,
  RoleHasPermissionEntity,
];
