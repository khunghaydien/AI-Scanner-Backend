import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { TokenPair } from '@app/auth';

@Injectable()
export class CookieService {
  /**
   * Xác định sameSite value dựa trên environment
   * - Production/Staging (cross-site): 'none' (yêu cầu secure: true)
   * - Development (có thể cùng domain): 'lax'
   */
  private getSameSiteValue(): 'strict' | 'lax' | 'none' {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    const frontendUrl = process.env.FRONTEND_URL || '';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3030';

    // Nếu là production/staging, luôn dùng 'none' cho cross-site cookies
    if (isProduction) {
      return 'none'; // Cross-site cookies yêu cầu sameSite: 'none' với secure: true
    }

    // Kiểm tra xem frontend và backend có cùng domain không
    try {
      if (frontendUrl && backendUrl) {
        const frontendDomain = new URL(frontendUrl).hostname;
        const backendDomain = new URL(backendUrl).hostname;
        
        if (frontendDomain !== backendDomain) {
          return 'none'; // Khác domain -> cần 'none'
        }
      }
    } catch (e) {
      // Nếu không parse được URL, fallback về 'lax'
    }

    return 'lax'; // Cùng domain trong development -> dùng 'lax'
  }

  private getCookieConfig() {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    return {
      httpOnly: true,
      secure: isProduction, // Secure cookies chỉ trong production (HTTPS)
      sameSite: this.getSameSiteValue() as 'strict' | 'lax' | 'none',
    };
  }

  private getAccessTokenConfig() {
    return {
      ...this.getCookieConfig(),
      maxAge: 15 * 60 * 1000, // 15 minutes
    };
  }

  private getRefreshTokenConfig() {
    return {
      ...this.getCookieConfig(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  setTokens(res: Response, tokens: TokenPair): void {
    res.cookie('accessToken', tokens.accessToken, this.getAccessTokenConfig());
    res.cookie('refreshToken', tokens.refreshToken, this.getRefreshTokenConfig());
  }

  setAccessToken(res: Response, accessToken: string): void {
    res.cookie('accessToken', accessToken, this.getAccessTokenConfig());
  }

  clearTokens(res: Response): void {
    const config = this.getCookieConfig();
    res.clearCookie('accessToken', config);
    res.clearCookie('refreshToken', config);
  }

  clearAccessToken(res: Response): void {
    const config = this.getCookieConfig();
    res.clearCookie('accessToken', config);
  }

  clearRefreshToken(res: Response): void {
    const config = this.getCookieConfig();
    res.clearCookie('refreshToken', config);
  }
}
