import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'model_has_permissions' })
@Index('model_has_permissions_model_id_model_type_index', [
  'modelId',
  'modelType',
])
export class ModelHasPermissionEntity {
  @PrimaryColumn({ name: 'permission_id', type: 'bigint' })
  permissionId!: string;

  @PrimaryColumn({ name: 'model_id', type: 'bigint' })
  modelId!: string;

  @PrimaryColumn({ name: 'model_type', type: 'varchar' })
  modelType!: string;
}
