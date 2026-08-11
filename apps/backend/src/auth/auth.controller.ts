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
import type { Request, Response } from 'express';
import { RawResponse } from '../common/interceptors/transform.interceptor';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('me')
  getMe(@CurrentUser() user: AdminPayload) {
    return { id: user.id, email: user.email };
  }

  @ApiOperation({ summary: 'Refresh access token' })
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

    const tokens = await this.authService.refreshTokens(refreshToken);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return new RawResponse({ accessToken: tokens.accessToken });
  }

  @ApiOperation({ summary: 'Logout (clear refresh token cookie)' })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', this.cookieBaseOptions());
    return new RawResponse({ message: 'Logout berhasil' });
  }

  @ApiOperation({ summary: 'Redirect ke Google OAuth consent screen' })
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleAuth() {}

  @ApiOperation({ summary: 'Callback Google OAuth' })
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleAuthCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    return this.handleOAuthCallback(req.user, res);
  }

  @ApiOperation({ summary: 'Redirect ke GitHub OAuth consent screen' })
  @UseGuards(AuthGuard('github'))
  @Get('github')
  githubAuth() {}

  @ApiOperation({ summary: 'Callback GitHub OAuth' })
  @UseGuards(AuthGuard('github'))
  @Get('github/callback')
  async githubAuthCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    return this.handleOAuthCallback(req.user, res);
  }

  @ApiOperation({ summary: 'Get OAuth access token from cookie (exchange)' })
  @HttpCode(HttpStatus.OK)
  @Post('oauth/token')
  exchangeOAuthToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = req.cookies?.['oauth_access_token'] as
      | string
      | undefined;

    res.clearCookie('oauth_access_token', this.cookieBaseOptions());

    if (!accessToken) {
      throw new UnauthorizedException('OAuth token tidak ditemukan');
    }

    return new RawResponse({ accessToken });
  }

  @ApiOperation({ summary: 'Get current logged in Visitor' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  private cookieBaseOptions() {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: (this.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
      path: '/api/auth',
    };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      ...this.cookieBaseOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private setOAuthAccessTokenCookie(res: Response, token: string) {
    res.cookie('oauth_access_token', token, {
      ...this.cookieBaseOptions(),
      maxAge: 60 * 1000,
    });
  }
}