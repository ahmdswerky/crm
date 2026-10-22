import { HttpStatus, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { EntityNotFoundFilter } from './filters/entity-not-found.filter';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: EntityNotFoundFilter,
    },
    {
      provide: APP_PIPE,
      useFactory: () => {
        return new ValidationPipe({
          whitelist: true,
          transform: true,
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      },
    },
  ],
})
export class CommonModule {}
