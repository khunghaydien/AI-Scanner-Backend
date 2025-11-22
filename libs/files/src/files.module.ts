import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { File } from '@app/database/entities/file.entity';
import { User } from '@app/database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([File, User])],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

