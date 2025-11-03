/**
 * HTTP API Server
 */

import express, { Application } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import cors from 'cors';
import { ApiConfig } from '../types';
import { SocketClient } from '../vsock/client';
import { L3Client } from '../l3/client';
import { AuthModule } from '../auth';
import { loggingMiddleware } from './middleware/logging';
import { errorMiddleware } from './middleware/error';
import { createRequestHandler } from './routes/request';
import { createAttestHandler } from './routes/attest';
import { createHealthHandler } from './routes/health';
import { createStatusHandler } from './routes/status';
import logger from '../utils/logger';

export interface ServerDependencies {
  vsockClient: SocketClient;
  l3Client: L3Client;
  authModule: AuthModule;
  tappId: string;
}

export function createServer(config: ApiConfig, deps: ServerDependencies): Application {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(cors());
  app.use(loggingMiddleware());

  // Routes
  app.post('/api/v1/request', createRequestHandler(deps.vsockClient));

  app.post('/api/v1/attest', createAttestHandler(deps.vsockClient, deps.l3Client, deps.tappId));

  app.get('/api/v1/health', createHealthHandler(deps.vsockClient, deps.l3Client));

  app.get('/api/v1/status', createStatusHandler(deps.vsockClient, deps.l3Client));

  // Error handling (must be last)
  app.use(errorMiddleware());

  logger.info('API server created', {
    port: config.port,
    tlsEnabled: config.tlsEnabled,
  });

  return app;
}

export function startServer(app: Application, config: ApiConfig): void {
  let server: http.Server | https.Server;

  if (config.tlsEnabled && config.tlsCert && config.tlsKey) {
    // HTTPS server
    const httpsOptions = {
      cert: fs.readFileSync(config.tlsCert),
      key: fs.readFileSync(config.tlsKey),
    };

    server = https.createServer(httpsOptions, app);
    server.listen(config.port, config.host, () => {
      logger.info('HTTPS server listening', {
        host: config.host,
        port: config.port,
      });
    });
  } else {
    // HTTP server
    server = app.listen(config.port, config.host, () => {
      logger.info('HTTP server listening', {
        host: config.host,
        port: config.port,
      });
    });
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}
