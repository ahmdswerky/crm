import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({ origin: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
bootstrap();
