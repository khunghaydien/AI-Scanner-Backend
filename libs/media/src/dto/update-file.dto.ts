import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
