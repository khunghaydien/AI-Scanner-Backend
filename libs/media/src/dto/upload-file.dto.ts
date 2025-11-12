import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UploadFileDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
