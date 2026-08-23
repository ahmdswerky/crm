import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'model_has_roles' })
@Index('model_has_roles_model_id_model_type_index', ['modelId', 'modelType'])
export class ModelHasRoleEntity {
  @PrimaryColumn({ name: 'role_id', type: 'bigint' })
  roleId!: string;

  @PrimaryColumn({ name: 'model_id', type: 'bigint' })
  modelId!: string;

  @PrimaryColumn({ name: 'model_type', type: 'varchar' })
  modelType!: string;
}
