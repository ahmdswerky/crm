import { InjectDataSource } from '@nestjs/typeorm';
import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class CrmUserRepository {
  constructor(
    @Optional()
    @InjectDataSource('auth')
    private readonly dataSource?: DataSource,
  ) {}

  async findActiveById(id: string): Promise<UserEntity | null> {
    if (!this.dataSource) {
      throw new Error('CRM user database is unavailable');
    }

    return this.dataSource.getRepository(UserEntity).findOne({
      where: { id },
    });
  }
}
