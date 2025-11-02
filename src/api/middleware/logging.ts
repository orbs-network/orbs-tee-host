/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

export function loggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Log request
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;

      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
      });
    });

    next();
  };
}
