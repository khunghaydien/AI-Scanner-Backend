import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { EncryptionService } from '@app/common';
import { User } from '@app/database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN,
      },
    }),
  ],
  controllers: [],
  providers: [AuthService, GoogleOAuthService, EncryptionService, JwtStrategy, RolesGuard],
  exports: [
    AuthService,
    GoogleOAuthService,
    EncryptionService,
    JwtStrategy,
    RolesGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
