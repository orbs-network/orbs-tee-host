/**
 * POST /api/v1/request - Forward request to enclave
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SocketClient } from '../../vsock/client';
import { TeeRequest, DAppRequest } from '../../types';
import logger from '../../utils/logger';

export function createRequestHandler(vsockClient: SocketClient) {
  return async (req: Request, res: Response) => {
    try {
      const dappRequest = req.body as DAppRequest;

      logger.info('Forwarding request to enclave', {
        method: dappRequest.method,
      });

      // Convert DApp request to TeeRequest
      const teeRequest: TeeRequest = {
        id: uuidv4(),
        method: dappRequest.method,
        params: dappRequest.params,
        timestamp: Date.now(),
      };

      // Send to enclave
      const response = await vsockClient.sendRequest(teeRequest);

      // Return response
      res.json(response);
    } catch (error) {
      logger.error('Request handling failed', { error: (error as Error).message });
      throw error;
    }
  };
}
