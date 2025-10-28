import { Module } from '@nestjs/common';
import { AuthModule as LibAuthModule } from '@app/auth';
import { CookieService } from '@app/common';
import { AuthController } from './auth.controller';

@Module({
  imports: [LibAuthModule],
  controllers: [AuthController],
  providers: [CookieService],
})
export class AuthModule {}
