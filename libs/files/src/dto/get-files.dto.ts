import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetFilesDto {
  @IsOptional()
  @IsString()
  cursor?: string; // Base64 encoded: `${updatedAt}_${id}`

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20; // Default 20 items per page
}

