import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'role_has_permissions' })
export class RoleHasPermissionEntity {
  @PrimaryColumn({ name: 'permission_id', type: 'bigint' })
  permissionId!: string;

  @PrimaryColumn({ name: 'role_id', type: 'bigint' })
  roleId!: string;
}
