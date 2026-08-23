import { Injectable } from '@nestjs/common';
import { CrmAuthRepository } from './crm-auth.repository';

@Injectable()
export class CrmAuthService {
  constructor(private readonly repository: CrmAuthRepository) {}

  authenticate(token: string) {
    return this.repository.findByBearerToken(token);
  }
}
