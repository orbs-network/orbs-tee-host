/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { VsocketError, L3Error, AuthError, ConfigError } from '../../utils/errors';
import logger from '../../utils/logger';

export function errorMiddleware() {
  return (err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Request error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
    });

    // Determine status code and response based on error type
    if (err instanceof VsocketError) {
      res.status(503).json({
        error: 'Enclave unavailable',
        message: err.message,
      });
    } else if (err instanceof L3Error) {
      res.status(503).json({
        error: 'L3 network unavailable',
        message: err.message,
      });
    } else if (err instanceof AuthError) {
      res.status(401).json({
        error: 'Authentication failed',
        message: err.message,
      });
    } else if (err instanceof ConfigError) {
      res.status(500).json({
        error: 'Configuration error',
        message: err.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    }
  };
}
