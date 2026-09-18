import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { RawResponse } from '../common/interceptors/transform.interceptor';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  AdminPayload,
  OAuthUserPayload,
  VisitorPayload,
} from './types/auth.types';
import { ConfigService } from '@nestjs/config';

type OAuthRequest = Request & { user: OAuthUserPayload };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
  }

  @ApiOperation({ summary: 'Login Admin' })
  @Public()
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginAdmin(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return new RawResponse({
      accessToken: result.accessToken,
      admin: result.admin,
    });
  }

  @ApiOperation({ summary: 'Get current logged in Admin' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Get('me')
  getMe(@CurrentUser() user: AdminPayload) {
    return { id: user.id, email: user.email };
  }

  // Publik: identitas pemanggil berasal dari refresh token di cookie, bukan
  // dari access token di header Authorization.
  @ApiOperation({ summary: 'Refresh access token (rotasi refresh token)' })
  @Public()
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }

    try {
      const tokens = await this.authService.refreshTokens(refreshToken);
      this.setRefreshTokenCookie(res, tokens.refreshToken);

      return new RawResponse({ accessToken: tokens.accessToken });
    } catch (err) {
      res.clearCookie('refresh_token', this.cookieBaseOptions());
      throw err;
    }
  }

  // Publik supaya logout tetap bisa dipanggil walau access token sudah expired
  // — sesi tetap dicabut berdasarkan refresh token di cookie.
  @ApiOperation({ summary: 'Logout (cabut refresh token + clear cookie)' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

    await this.authService.revokeRefreshToken(refreshToken);

    res.clearCookie('refresh_token', this.cookieBaseOptions());
    return new RawResponse({ message: 'Logout berhasil' });
  }

  // Alur OAuth memakai guard Passport-nya sendiri. @Public() melepasnya dari
  // JwtAuthGuard global, yang kalau tidak akan menolak request ini lebih dulu
  // karena pengunjung memang belum punya JWT saat memulai login.
  @ApiOperation({ summary: 'Redirect ke Google OAuth consent screen' })
  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleAuth() {}

  @ApiOperation({ summary: 'Callback Google OAuth' })
  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleAuthCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    return this.handleOAuthCallback(req.user, res);
  }

  @ApiOperation({ summary: 'Redirect ke GitHub OAuth consent screen' })
  @Public()
  @UseGuards(AuthGuard('github'))
  @Get('github')
  githubAuth() {}

  @ApiOperation({ summary: 'Callback GitHub OAuth' })
  @Public()
  @UseGuards(AuthGuard('github'))
  @Get('github/callback')
  async githubAuthCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    return this.handleOAuthCallback(req.user, res);
  }

  // Publik: menukar cookie sekali pakai yang baru di-set oleh callback OAuth
  // menjadi access token; pemanggil belum memegang token apa pun.
  @ApiOperation({ summary: 'Get OAuth access token from cookie (exchange)' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('oauth/token')
  exchangeOAuthToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = req.cookies?.['oauth_access_token'] as
      string | undefined;

    res.clearCookie('oauth_access_token', this.cookieBaseOptions());

    if (!accessToken) {
      throw new UnauthorizedException('OAuth token tidak ditemukan');
    }

    return new RawResponse({ accessToken });
  }

  @ApiOperation({ summary: 'Get current logged in Visitor' })
  @ApiBearerAuth('access-token')
  @Roles('VISITOR')
  @Get('visitor/me')
  getVisitorMe(@CurrentUser() user: VisitorPayload) {
    return {
      id: user.id,
      provider: user.provider,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }

  // Private helpers

  private async handleOAuthCallback(user: OAuthUserPayload, res: Response) {
    const tokens = await this.authService.validateOAuthVisitor(user);
    const frontendUrl = this.authService.getValidatedRedirectUrl();

    this.setRefreshTokenCookie(res, tokens.refreshToken);
    this.setOAuthAccessTokenCookie(res, tokens.accessToken);

    return res.redirect(`${frontendUrl}/guestbook?oauth=success`);
  }

  private cookieBaseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/api/auth',
    };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      ...this.cookieBaseOptions(),
      maxAge: this.authService.refreshTokenTtlMs,
    });
  }

  private setOAuthAccessTokenCookie(res: Response, token: string) {
    res.cookie('oauth_access_token', token, {
      ...this.cookieBaseOptions(),
      maxAge: 60 * 1000,
    });
  }
}
