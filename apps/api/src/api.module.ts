import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { AuthModule } from './auth/auth.module';
import { MediaModule } from './media/media.module';
import { User } from '@app/database/entities/user.entity';
import { Media } from '@app/database/entities/media.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT as string, 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASS,
      database: process.env.POSTGRES_DB,
      entities: [User, Media],
      synchronize: false,
      logging: false,
    }),
    AuthModule,
    MediaModule,
    TypeOrmModule.forFeature([User, Media]),
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
