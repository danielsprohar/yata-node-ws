import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ActiveUser } from '../decorators';
import { COOKIE_REFRESH_TOKEN_KEY } from '../iam.constants';
import { AuthenticationService } from './authentication.service';
import { Auth, Public } from './decorators';
import { SignInDto, SignUpDto } from './dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AuthType } from './enums';
import { authCookieOptions } from '../iam.constants';
import { Cookies } from '../../decorators/cookies.decorator';

@ApiTags('Authentication')
@Public()
@Controller('authentication')
export class AuthenticationController {
  constructor(private authService: AuthenticationService) {}

  @Post('logout')
  @Auth(AuthType.BEARER)
  @HttpCode(HttpStatus.OK)
  async logout(
    @ActiveUser('sub') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);
    res.clearCookie(COOKIE_REFRESH_TOKEN_KEY, authCookieOptions);
    return HttpStatus.OK;
  }

  @Post('refresh-tokens')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Cookies(COOKIE_REFRESH_TOKEN_KEY) refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!refreshToken) {
      console.error('Unable to pick the token from the cookie jar');
      throw new UnauthorizedException();
    }

    res.clearCookie(COOKIE_REFRESH_TOKEN_KEY, authCookieOptions);

    const authServiceRes = await this.authService.refreshTokens(refreshToken);

    res.cookie(
      COOKIE_REFRESH_TOKEN_KEY,
      authServiceRes.refreshToken,
      authCookieOptions,
    );

    return {
      accessToken: authServiceRes.accessToken,
      user: authServiceRes.user,
    };
  }

  @Post('sign-up')
  @HttpCode(HttpStatus.OK)
  async signUp(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: SignUpDto,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.signUp(
      dto,
    );

    res.cookie(COOKIE_REFRESH_TOKEN_KEY, refreshToken, authCookieOptions);

    const authResponseDto: AuthResponseDto = { accessToken, user };
    return authResponseDto;
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: SignInDto,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.signIn(
      dto,
    );

    res.cookie(COOKIE_REFRESH_TOKEN_KEY, refreshToken, authCookieOptions);

    const authResponseDto: AuthResponseDto = { accessToken, user };
    return authResponseDto;
  }
}
