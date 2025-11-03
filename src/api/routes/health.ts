/**
 * GET /api/v1/health - Health check endpoint
 */

import { Request, Response } from 'express';
import { SocketClient } from '../../vsock/client';
import { L3Client } from '../../l3/client';
import { HealthStatus } from '../../types';

const startTime = Date.now();

export function createHealthHandler(
  vsockClient: SocketClient,
  l3Client: L3Client
) {
  return async (_req: Request, res: Response) => {
    try {
      // Check enclave connection
      const enclaveConnected = vsockClient.isConnected();

      // Check L3 reachability
      const l3Reachable = await l3Client.checkHealth();

      // Calculate uptime
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

      const status: HealthStatus = {
        status: enclaveConnected && l3Reachable ? 'healthy' : 'unhealthy',
        enclaveConnected,
        l3Reachable,
        uptimeSeconds,
      };

      res.json(status);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
      });
    }
  };
}
