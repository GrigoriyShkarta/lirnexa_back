import { Role } from '@prisma/client';

/**
 * structure of the JWT payload.
 */
export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
}
