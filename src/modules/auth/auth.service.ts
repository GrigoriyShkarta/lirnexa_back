import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role, User } from '@prisma/client';
import { Response } from 'express';

@Injectable()
/**
 * Service handling authentication logic: login, registration, and token management.
 */
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt_service: JwtService,
    private config_service: ConfigService,
  ) {}

  /**
   * Registers a new user with the 'student' role.
   * @param dto Registration data.
   */
  async register(dto: RegisterDto): Promise<void> {
    const existing_user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing_user) {
      throw new BadRequestException([{ email: 'email_already_exists' }]);
    }

    const hashed_password = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashed_password,
        role: Role.super_admin,
      },
    });
  }

  /**
   * Authenticates a user and returns their profile with tokens.
   * @param dto Login credentials.
   * @param res Express response.
   */
  async login(
    dto: LoginDto,
    res: Response,
  ): Promise<{
    token: string;
    refresh_token: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('wrong_email_or_password');
    }

    const is_password_valid = await bcrypt.compare(dto.password, user.password);

    if (!is_password_valid) {
      throw new BadRequestException('wrong_email_or_password');
    }

    const tokens = await this.generate_tokens(user);
    this.set_tokens_to_cookies(res, tokens.access_token, tokens.refresh_token);

    return {
      token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  /**
   * Refreshes access and refresh tokens.
   * @param refresh_token Current refresh token.
   * @param res Express response.
   */
  async refresh_tokens(
    refresh_token: string,
    res: Response,
  ): Promise<{
    token: string;
    refresh_token: string;
  }> {
    if (!refresh_token) {
      throw new NotFoundException('invalid_credentional');
    }

    try {
      const payload = await this.jwt_service.verifyAsync(refresh_token, {
        secret: this.config_service.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new NotFoundException('invalid_credentional');
      }

      const tokens = await this.generate_tokens(user);
      this.set_tokens_to_cookies(res, tokens.access_token, tokens.refresh_token);

      return {
        token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      };
    } catch {
      throw new NotFoundException('invalid_credentional');
    }
  }

  /**
   * Generates access and refresh tokens for a user.
   * @param user User object.
   */
  private async generate_tokens(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [access_token, refresh_token] = await Promise.all([
      this.jwt_service.signAsync(payload, {
        secret: this.config_service.get<string>('JWT_SECRET'),
        expiresIn: '12h',
      }),
      this.jwt_service.signAsync(payload, {
        secret: this.config_service.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { access_token, refresh_token };
  }

  /**
   * Sets tokens in HttpOnly cookies.
   * @param res Express response.
   * @param access_token Access JWT.
   * @param refresh_token Refresh JWT.
   */
  private set_tokens_to_cookies(
    res: Response,
    access_token: string,
    refresh_token: string,
  ): void {
    const is_prod =
      this.config_service.get<string>('NODE_ENV') === 'production';

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: is_prod,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    });

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: is_prod,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
