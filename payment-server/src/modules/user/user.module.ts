import { Module } from '@nestjs/common';
import { CrmUserRepository } from './user.repository';
import { CrmUserService } from './user.service';

@Module({
  providers: [CrmUserRepository, CrmUserService],
  exports: [CrmUserRepository, CrmUserService],
})
export class UserModule {}
