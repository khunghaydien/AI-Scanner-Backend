import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaModule as MediaLibModule } from '@app/media';

@Module({
  imports: [MediaLibModule],
  controllers: [MediaController],
})
export class MediaModule {}
