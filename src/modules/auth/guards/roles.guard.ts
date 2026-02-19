import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
/**
 * Role-based access control guard.
 * Checks if the user's role matches the required roles for an endpoint.
 */
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Logic to determine if the user has the required roles.
   * @param context Execution context.
   */
  canActivate(context: ExecutionContext): boolean {
    const required_roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required_roles || required_roles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.role) {
      throw new ForbiddenException();
    }

    const has_role = required_roles.includes(user.role);
    
    if (!has_role) {
      throw new ForbiddenException();
    }

    return true;
  }
}
