import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { PublicUserResponse } from '@evalpilot/shared';
import type { Response } from 'express';
import { CurrentUser, Public, SessionAuth } from '../common/decorators/auth.decorators';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { InjectConfig, type AppConfig } from '@evalpilot/server-core';
import type { AuthUser } from '../types/auth';
import { toPublicUser, UsersService } from '../users/users.service';
import { AuthProvidersDto, LoginDto, PublicUserDto, RegisterDto } from './auth.dto';
import { GithubAuthGuard, LocalAuthGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  @Public()
  @RateLimit('auth')
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session' })
  @ApiCreatedResponse({ type: PublicUserDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUserResponse> {
    const user = await this.auth.register(dto);
    setSessionCookie(res, this.auth.issueToken(user.id), this.config);
    return toPublicUser(user);
  }

  @Public()
  @RateLimit('auth')
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password; sets the session cookie' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: PublicUserDto })
  async login(
    @CurrentUser() current: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUserResponse> {
    setSessionCookie(res, this.auth.issueToken(current.id), this.config);
    return this.me(current);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the session (clears the cookie)' })
  @ApiNoContentResponse()
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res, this.config);
  }

  @SessionAuth()
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiOkResponse({ type: PublicUserDto })
  async me(@CurrentUser() current: AuthUser): Promise<PublicUserResponse> {
    const user = await this.users.findById(current.id);
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'Which sign-in providers are enabled' })
  @ApiOkResponse({ type: AuthProvidersDto })
  providers(): { github: boolean } {
    return { github: this.config.github !== null };
  }

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github')
  @ApiOperation({ summary: 'Start GitHub sign-in (404 when not configured)' })
  github(): void {
    // Passport redirects to GitHub.
  }

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  githubCallback(@CurrentUser() user: AuthUser, @Res() res: Response): void {
    setSessionCookie(res, this.auth.issueToken(user.id), this.config);
    res.redirect(`${this.config.webUrl}/app`);
  }
}
