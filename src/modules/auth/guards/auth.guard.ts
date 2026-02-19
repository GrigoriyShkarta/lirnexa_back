import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
/**
 * Global authentication guard.
 * Validates JWT from cookies and handles public/private access.
 */
export class AuthGuard implements CanActivate {
  constructor(
    private jwt_service: JwtService,
    private config_service: ConfigService,
    private reflector: Reflector,
  ) {}

  /**
   * Logic to determine if a request is authorized.
   * @param context Execution context.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const is_public = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (is_public) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extract_token_from_cookie(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwt_service.verifyAsync(token, {
        secret: this.config_service.get<string>('JWT_SECRET'),
      });
      // Attach user information to the request
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  /**
   * Extracts JWT token from request cookies.
   * @param request Express request object.
   */
  private extract_token_from_cookie(request: Request): string | undefined {
    return request.cookies?.access_token;
  }
}
