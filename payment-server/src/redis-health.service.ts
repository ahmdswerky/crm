import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.PAYMENTS_REDIS_ENABLED === 'false'
    ) {
      this.client = null;
      return;
    }

    this.client = new Redis({
      host: process.env.PAYMENTS_REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.PAYMENTS_REDIS_PORT ?? 6379),
      username: process.env.PAYMENTS_REDIS_USERNAME ?? 'payments',
      password: process.env.PAYMENTS_REDIS_PASSWORD,
      lazyConnect: true,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      keyPrefix: process.env.PAYMENTS_REDIS_PREFIX ?? 'payments:',
    });
  }

  async ping(): Promise<void> {
    if (!this.client) {
      throw new Error('redis is not configured');
    }

    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
