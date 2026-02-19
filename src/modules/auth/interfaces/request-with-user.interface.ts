import { Request } from 'express';
import { AuthPayload } from './payload.interface';

/**
 * Extended Express request including authenticated user payload.
 */
export interface RequestWithUser extends Request {
  user: AuthPayload;
}
