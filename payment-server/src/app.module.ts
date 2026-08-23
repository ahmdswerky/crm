import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { RedisHealthService } from './redis-health.service';
import { AuthModule } from './modules/auth/auth.module';
import { CRM_AUTH_ENTITIES } from './modules/auth/entities';
import { InvoiceModule } from './modules/invoice/invoice.module';

const databaseModule =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        TypeOrmModule.forRoot({
          name: 'payments',
          type: 'postgres',
          host: process.env.PAYMENTS_DB_HOST ?? '127.0.0.1',
          port: Number(process.env.PAYMENTS_DB_PORT ?? 5432),
          username: process.env.PAYMENTS_DB_USER ?? 'payments_app',
          password: process.env.PAYMENTS_DB_PASSWORD,
          database: process.env.PAYMENTS_DB_NAME ?? 'payments',
          autoLoadEntities: true,
          migrations: [join(__dirname, 'database/migrations/*.js')],
          migrationsRun: process.env.PAYMENTS_MIGRATIONS_RUN === 'true',
          synchronize: false,
          retryAttempts: 1,
          connectTimeoutMS: 1000,
        }),
        TypeOrmModule.forRoot({
          name: 'auth',
          type: 'postgres',
          host: process.env.PAYMENTS_AUTH_DB_HOST ?? '127.0.0.1',
          port: Number(process.env.PAYMENTS_AUTH_DB_PORT ?? 5432),
          username: process.env.PAYMENTS_AUTH_DB_USER ?? 'auth_reader',
          password: process.env.PAYMENTS_AUTH_DB_PASSWORD,
          database: process.env.PAYMENTS_AUTH_DB_NAME ?? 'crm',
          entities: CRM_AUTH_ENTITIES,
          synchronize: false,
          retryAttempts: 1,
          connectTimeoutMS: 1000,
        }),
      ];

@Module({
  imports: [...databaseModule, AuthModule, InvoiceModule],
  controllers: [AppController, HealthController],
  providers: [AppService, RedisHealthService],
})
export class AppModule {}
