import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaService } from './media.service';
import { Media } from '@app/database/entities/media.entity';
import { User } from '@app/database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Media, User])],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
