import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './auth.constants';
import { AuthDatabaseUnavailableError } from './crm-auth.repository';
import { CrmAuthService } from './crm-auth.service';
import { AuthenticatedRequest } from './auth.types';

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

@Injectable()
export class CrmAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: CrmAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const user = await this.authService.authenticate(token);

      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }

      request.crmUser = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof AuthDatabaseUnavailableError) {
        throw new ServiceUnavailableException(
          'Authentication service unavailable',
        );
      }

      throw error;
    }
  }
}
