import { Injectable } from '@nestjs/common';
import { CrmUserRepository } from './user.repository';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class CrmUserService {
  constructor(private readonly repository: CrmUserRepository) {}

  findActiveById(id: string): Promise<UserEntity | null> {
    return this.repository.findActiveById(id);
  }
}
