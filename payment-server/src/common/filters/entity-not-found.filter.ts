import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';

@Catch(EntityNotFoundError)
export class EntityNotFoundFilter implements ExceptionFilter {
  catch(exception: EntityNotFoundError) {
    const match = exception.message.match(/type "(\w+)"/);
    const entityClass = match ? match[1] : 'Entity';

    throw new HttpException(`${entityClass} Not Found.`, HttpStatus.NOT_FOUND, {
      cause: exception.cause,
    });
  }
}
