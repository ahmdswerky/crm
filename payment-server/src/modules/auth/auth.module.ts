import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UserModule } from '../user/user.module';
import { CrmAuthGuard } from './crm-auth.guard';
import { CrmAuthRepository } from './crm-auth.repository';
import { CrmAuthService } from './crm-auth.service';
import { PermissionGuard } from './permission.guard';

@Module({
  imports: [UserModule],
  providers: [
    CrmAuthRepository,
    CrmAuthService,
    CrmAuthGuard,
    PermissionGuard,
    { provide: APP_GUARD, useExisting: CrmAuthGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
  ],
  exports: [CrmAuthService, CrmAuthGuard, PermissionGuard],
})
export class AuthModule {}
