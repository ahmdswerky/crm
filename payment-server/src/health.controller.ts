import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisHealthService } from './redis-health.service';
import { Public } from './modules/auth/public.decorator';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    @Optional()
    @InjectDataSource('payments')
    private readonly paymentsDataSource: DataSource | undefined,
    @Optional()
    @InjectDataSource('auth')
    private readonly authDataSource: DataSource | undefined,
    private readonly redisHealth: RedisHealthService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const checks = { database: false, auth: false, redis: false };

    try {
      if (!this.paymentsDataSource || !this.authDataSource) {
        throw new Error('database is not configured');
      }

      await this.paymentsDataSource.query('SELECT 1');
      checks.database = true;
      await this.authDataSource.query('SELECT 1');
      checks.auth = true;
      await this.redisHealth.ping();
      checks.redis = true;

      return { status: 'ok', checks };
    } catch {
      throw new HttpException(
        { status: 'not_ready', checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
