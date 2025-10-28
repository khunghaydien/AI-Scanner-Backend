import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleUserInfo {
  id: string;
  email: string;
  fullName: string;
  picture: string;
  verified_email: boolean;
}

@Injectable()
export class GoogleOAuthService {
  private client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  }

  // Normalize redirect URI (remove trailing slash, ensure correct format)
  private getRedirectUri(): string {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3030';
    if (!backendUrl) {
      throw new Error('BACKEND_URL environment variable is not set');
    }
    // Remove trailing slash if exists, then add callback path
    const normalizedUrl = backendUrl.replace(/\/$/, '');
    const redirectUri = `${normalizedUrl}/auth/google/callback`;
    return redirectUri;
  }

  // Tạo Google OAuth URL để redirect user đến Google
  getAuthUrl(): string {
    const redirectUri = this.getRedirectUri();

    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      redirect_uri: redirectUri,
    });

    return authUrl;
  }

  // Xử lý callback từ Google OAuth
  async handleCallback(code: string): Promise<GoogleUserInfo> {
    try {
      const redirectUri = this.getRedirectUri();

      // Exchange code for tokens
      const { tokens } = await this.client.getToken({
        code,
        redirect_uri: redirectUri,
      });

      this.client.setCredentials(tokens);

      // Get user info from Google
      const response = await this.client.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });

      const userInfo = response.data as any;

      if (!userInfo.email || !userInfo.verified_email) {
        throw new UnauthorizedException('google_email_not_verified');
      }

      return {
        id: userInfo.id,
        email: userInfo.email,
        fullName: userInfo.name,
        picture: userInfo.picture,
        verified_email: userInfo.verified_email,
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Enhanced error logging for redirect_uri_mismatch
      if (error.message && error.message.includes('redirect_uri_mismatch')) {
        const redirectUri = this.getRedirectUri();
        throw new UnauthorizedException(
          `redirect_uri_mismatch: Please add ${redirectUri} to Google Cloud Console`
        );
      }
      throw new UnauthorizedException('google_oauth_failed');
    }
  }
}
