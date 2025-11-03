/**
 * POST /api/v1/attest - Trigger attestation submission
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SocketClient } from '../../vsock/client';
import { L3Client } from '../../l3/client';
import { TeeRequest, AttestationBundle } from '../../types';
import logger from '../../utils/logger';

export function createAttestHandler(vsockClient: SocketClient, l3Client: L3Client, tappId: string) {
  return async (_req: Request, res: Response) => {
    try {
      logger.info('Requesting attestation from enclave');

      // Request attestation from enclave
      const attestationRequest: TeeRequest = {
        id: uuidv4(),
        method: 'get_attestation',
        params: {},
        timestamp: Date.now(),
      };

      const response = await vsockClient.sendRequest(attestationRequest);

      if (!response.success || !response.data) {
        throw new Error('Failed to get attestation from enclave');
      }

      // Extract attestation data
      const attestationDoc = Buffer.from(response.data.attestation, 'base64');
      const certificateChain = response.data.certificates.map((cert: string) =>
        Buffer.from(cert, 'base64')
      );

      // Assemble bundle
      const bundle: AttestationBundle = {
        attestationDoc,
        certificateChain,
        enclavePublicKey: response.data.publicKey,
        tappId,
      };

      // Submit to L3
      const submission = await l3Client.submitAttestation(bundle);

      logger.info('Attestation submitted successfully', {
        attestationId: submission.attestationId,
      });

      // Return confirmation
      res.json({
        status: 'submitted',
        attestationId: submission.attestationId,
        submissionTime: submission.submissionTime,
      });
    } catch (error) {
      logger.error('Attestation failed', { error: (error as Error).message });
      throw error;
    }
  };
}
