import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { User } from '@app/database/entities/user.entity';
import { File } from '@app/database/entities/file.entity';

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
      entities: [User, File],
      synchronize: false,
      logging: false,
    }),
    AuthModule,
    FilesModule,
    TypeOrmModule.forFeature([User, File]),
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
