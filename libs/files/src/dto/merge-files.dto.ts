import { IsArray, IsUUID } from 'class-validator';

export class MergeFilesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  fileIds: string[];
}

