import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesModule as FilesLibModule } from '@app/files';

@Module({
  imports: [FilesLibModule],
  controllers: [FilesController],
})
export class FilesModule {}


