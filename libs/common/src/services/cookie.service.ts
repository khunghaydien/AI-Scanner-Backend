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
    // Detect if we're in production/staging environment
    const isProduction = 
      process.env.NODE_ENV === 'production' || 
      process.env.NODE_ENV === 'staging' ||
      process.env.RAILWAY_ENVIRONMENT === 'production';
    
    // Detect if we're behind HTTPS proxy (Railway, Heroku, etc.)
    // Railway proxies HTTPS requests, so we need secure cookies
    const isSecure = 
      isProduction || 
      process.env.RAILWAY_ENVIRONMENT !== undefined ||
      process.env.FORCE_SECURE_COOKIES === 'true';
    
    const sameSite = this.getSameSiteValue();
    
    // If sameSite is 'none', secure MUST be true (browser requirement)
    const secure = sameSite === 'none' ? true : isSecure;
    
    return {
      httpOnly: true,
      secure: secure,
      sameSite: sameSite as 'strict' | 'lax' | 'none',
      // Don't set domain - let browser handle it automatically
      // path: '/', // Explicitly set path if needed
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
