/**
 * ORBS L3 Guardian Network Client (Simplified)
 * Submits attestations to a single L3 endpoint
 */

import axios, { AxiosError } from 'axios';
import { L3Config, AttestationBundle, AttestationSubmission, ConsensusStatus } from '../types';
import { L3Error } from '../utils/errors';
import { retryWithBackoff } from '../utils/retry';
import logger from '../utils/logger';

export class L3Client {
  private readonly config: L3Config;

  constructor(config: L3Config) {
    this.config = config;
  }

  /**
   * Submit attestation to L3 endpoint
   */
  async submitAttestation(bundle: AttestationBundle): Promise<AttestationSubmission> {
    logger.info('Submitting attestation to L3', {
      endpoint: this.config.endpoint,
      tappId: bundle.tappId,
    });

    const payload = {
      attestation_doc: bundle.attestationDoc.toString('base64'),
      certificate_chain: bundle.certificateChain.map((cert) => cert.toString('base64')),
      enclave_public_key: bundle.enclavePublicKey,
      tapp_id: bundle.tappId,
    };

    return retryWithBackoff(
      async () => {
        try {
          const response = await axios.post(`${this.config.endpoint}/attestation/submit`, payload, {
            timeout: this.config.timeoutMs,
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const submission: AttestationSubmission = {
            attestationId: response.data.attestation_id,
            submissionTime: new Date(response.data.submission_time),
            status: response.data.status,
          };

          logger.info('Attestation submitted successfully', {
            attestationId: submission.attestationId,
          });

          return submission;
        } catch (error) {
          const axiosError = error as AxiosError;
          logger.warn('L3 submission failed', {
            endpoint: this.config.endpoint,
            error: axiosError.message,
            status: axiosError.response?.status,
          });
          throw new L3Error(`Failed to submit attestation: ${axiosError.message}`);
        }
      },
      {
        maxAttempts: this.config.retryAttempts,
        delayMs: 1000,
        backoffMultiplier: 2,
      }
    );
  }

  /**
   * Query consensus status for an attestation
   */
  async queryConsensusStatus(attestationId: string): Promise<ConsensusStatus> {
    logger.debug('Querying consensus status', {
      attestationId,
      endpoint: this.config.endpoint,
    });

    try {
      const response = await axios.get(
        `${this.config.endpoint}/attestation/status/${attestationId}`,
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
      const axiosError = error as AxiosError;
      throw new L3Error(`Failed to query consensus status: ${axiosError.message}`);
    }
  }

  /**
   * Check if L3 endpoint is reachable
   */
  async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.config.endpoint}/health`, {
        timeout: 5000,
      });
      logger.debug('L3 endpoint is reachable', {
        endpoint: this.config.endpoint,
      });
      return true;
    } catch (error) {
      logger.warn('L3 endpoint is unreachable', {
        endpoint: this.config.endpoint,
        error: (error as Error).message,
      });
      return false;
    }
  }
}
