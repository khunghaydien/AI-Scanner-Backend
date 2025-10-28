import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService, JwtAuthGuard } from '@app/auth';
import { SignInDto, SignUpDto } from '@app/auth/dto';
import { ResponseDto, CookieService } from '@app/common';
import { Response as ExpressResponse } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService
  ) {}

  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() signUpDto: SignUpDto, @Res({ passthrough: true }) res: ExpressResponse) {
    const result = await this.authService.signUp(signUpDto);
    const tokens = await this.authService.generateTokensForUser(result.user.id);
    this.cookieService.setTokens(res, tokens);
    return ResponseDto.created(result, 'user_created_successfully');
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: SignInDto, @Res({ passthrough: true }) res: ExpressResponse) {
    const result = await this.authService.signIn(signInDto);
    const tokens = await this.authService.generateTokensForUser(result.user.id);
    this.cookieService.setTokens(res, tokens);
    return ResponseDto.success(result, 'sign_in_successful');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Request() req, @Res({ passthrough: true }) res: ExpressResponse) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('refresh_token_not_found');
    }
    const result = await this.authService.refreshToken(refreshToken);
    this.cookieService.setAccessToken(res, result.accessToken);
    return ResponseDto.success({}, 'token_refreshed_successfully');
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  async signOut(@Res({ passthrough: true }) res: ExpressResponse) {
    this.cookieService.clearTokens(res);
    return ResponseDto.success({}, 'sign_out_successful');
  }

  @Get('google/url')
  getGoogleAuthUrl() {
    const authUrl = this.authService.getGoogleAuthUrl();
    return ResponseDto.success({ authUrl }, 'google_auth_url_generated');
  }

  @Get('google/callback')
  async googleCallback(@Request() req, @Res({ passthrough: false }) res: ExpressResponse) {
    const { code } = req.query;
    if (!code) {
      throw new UnauthorizedException('authorization_code_missing');
    }
    const result = await this.authService.handleGoogleCallback(code as string);
    const tokens = await this.authService.generateTokensForUser(result.user.id);
    this.cookieService.setTokens(res, tokens);
    res.redirect(process.env.FRONTEND_URL || '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req) {
    return ResponseDto.success(req.user, 'user_info_retrieved');
  }
}
