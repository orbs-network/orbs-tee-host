/**
 * GET /api/v1/status - Detailed status endpoint
 */

import { Request, Response } from 'express';
import { SocketClient } from '../../vsock/client';
import { L3Client } from '../../l3/client';
import { StatusResponse } from '../../types';

const startTime = Date.now();
let requestsProcessed = 0;

export function createStatusHandler(vsockClient: SocketClient, l3Client: L3Client) {
  return async (_req: Request, res: Response) => {
    try {
      // Check enclave connection
      const enclaveConnected = vsockClient.isConnected();

      // Check L3 endpoint
      const l3Reachable = await l3Client.checkHealth();

      // Calculate uptime
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

      const status: StatusResponse = {
        hostVersion: '0.1.0',
        status: enclaveConnected && l3Reachable ? 'healthy' : 'unhealthy',
        enclaveConnected,
        enclavePublicKey: undefined, // TODO: Get from enclave
        l3Reachable,
        l3GuardiansReachable: l3Reachable ? 1 : 0,
        uptimeSeconds,
        requestsProcessed,
      };

      res.json(status);
    } catch (error) {
      res.status(503).json({
        error: (error as Error).message,
      });
    }
  };
}

export function incrementRequestCount() {
  requestsProcessed++;
}
