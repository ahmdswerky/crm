import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export abstract class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  per_page: number = 15;
}
