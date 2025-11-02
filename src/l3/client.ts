/**
 * ORBS L3 Guardian Network Client
 * Handles attestation submission and consensus tracking
 */

import axios, { AxiosError } from 'axios';
import {
  L3Config,
  AttestationBundle,
  AttestationSubmission,
  ConsensusStatus,
} from '../types';
import { L3Error } from '../utils/errors';
import logger from '../utils/logger';

export class L3Client {
  private readonly config: L3Config;

  constructor(config: L3Config) {
    this.config = config;
  }

  /**
   * Submit attestation to L3 guardian network
   * Tries each guardian endpoint until one succeeds
   */
  async submitAttestation(
    bundle: AttestationBundle
  ): Promise<AttestationSubmission> {
    logger.info('Submitting attestation to L3 network', {
      tappId: bundle.tappId,
      guardians: this.config.endpoints.length,
    });

    const payload = {
      attestation_doc: bundle.attestationDoc.toString('base64'),
      certificate_chain: bundle.certificateChain.map((cert) =>
        cert.toString('base64')
      ),
      enclave_public_key: bundle.enclavePublicKey,
      tapp_id: bundle.tappId,
    };

    let lastError: Error | undefined;

    // Try each guardian endpoint
    for (const endpoint of this.config.endpoints) {
      try {
        logger.debug('Attempting guardian endpoint', { endpoint });

        const response = await axios.post(
          `${endpoint}/attestation/submit`,
          payload,
          {
            timeout: this.config.timeoutMs,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const submission: AttestationSubmission = {
          attestationId: response.data.attestation_id,
          submissionTime: new Date(response.data.submission_time),
          status: response.data.status,
        };

        logger.info('Attestation submitted successfully', {
          attestationId: submission.attestationId,
          guardian: endpoint,
        });

        return submission;
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        logger.warn('Guardian endpoint failed', {
          endpoint,
          error: axiosError.message,
          status: axiosError.response?.status,
        });

        // Continue to next guardian
        continue;
      }
    }

    // All guardians failed
    throw new L3Error(
      `All guardians unreachable: ${lastError?.message || 'unknown error'}`
    );
  }

  /**
   * Query consensus status for an attestation
   */
  async queryConsensusStatus(
    attestationId: string
  ): Promise<ConsensusStatus> {
    logger.debug('Querying consensus status', { attestationId });

    // Try each guardian
    for (const endpoint of this.config.endpoints) {
      try {
        const response = await axios.get(
          `${endpoint}/attestation/status/${attestationId}`,
          {
            timeout: this.config.timeoutMs,
          }
        );

        const status: ConsensusStatus = {
          attestationId: response.data.attestation_id,
          status: response.data.status,
          guardiansVerified: response.data.guardians_verified,
          totalGuardians: response.data.total_guardians,
        };

        logger.debug('Consensus status retrieved', {
          attestationId,
          status: status.status,
          verified: `${status.guardiansVerified}/${status.totalGuardians}`,
        });

        return status;
      } catch (error) {
        logger.debug('Guardian query failed', {
          endpoint,
          error: (error as Error).message,
        });
        // Try next guardian
        continue;
      }
    }

    throw new L3Error('Failed to query consensus status from all guardians');
  }

  /**
   * Check if guardians are reachable
   */
  async checkGuardiansHealth(): Promise<{
    reachable: number;
    total: number;
  }> {
    let reachable = 0;

    const promises = this.config.endpoints.map(async (endpoint) => {
      try {
        await axios.get(`${endpoint}/health`, {
          timeout: 5000,
        });
        return true;
      } catch {
        return false;
      }
    });

    const results = await Promise.all(promises);
    reachable = results.filter((r) => r).length;

    logger.debug('Guardian health check', {
      reachable,
      total: this.config.endpoints.length,
    });

    return {
      reachable,
      total: this.config.endpoints.length,
    };
  }
}
