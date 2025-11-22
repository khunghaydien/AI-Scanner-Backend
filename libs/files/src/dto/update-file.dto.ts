import { IsString, IsOptional } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  @IsOptional()
  status?: string;
}
