/**
 * Authentication middleware (Phase 2 feature)
 */

import { Request, Response, NextFunction } from 'express';
import { AuthModule } from '../../auth';

export function authMiddleware(_authModule: AuthModule) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      // TODO: Extract and verify signature from request
      // const signature = req.headers.authorization;
      // const isValid = await authModule.verifyRequestSignature(req.body);

      // if (!isValid) {
      //   throw new AuthError('Invalid signature');
      // }

      next();
    } catch (error) {
      next(error);
    }
  };
}
