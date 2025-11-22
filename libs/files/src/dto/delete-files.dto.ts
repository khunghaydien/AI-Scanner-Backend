import { IsArray, IsUUID } from 'class-validator';

export class DeleteFilesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  fileIds: string[];
}


