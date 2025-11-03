/**
 * End-to-End Tests
 * Tests complete workflows including L3 attestation submission
 */

import request from 'supertest';
import { Application } from 'express';
import nock from 'nock';
import { MockEnclave } from '../helpers/mock-enclave';
import { createServer } from '../../src/api/server';
import { UnixSocketClient } from '../../src/vsock/client';
import { L3Client } from '../../src/l3/client';
import { AuthModule } from '../../src/auth';
import { ApiConfig, VsockConfig, L3Config, AuthConfig } from '../../src/types';

describe('End-to-End Tests', () => {
  let mockEnclave: MockEnclave;
  let app: Application;
  let vsockClient: UnixSocketClient;
  let l3Client: L3Client;
  let authModule: AuthModule;

  const socketPath = '/tmp/enclave-e2e-test.sock';
  const l3Endpoint = 'http://mock-l3-guardian.test';

  beforeAll(async () => {
    // Start mock enclave
    mockEnclave = new MockEnclave({ socketPath });
    await mockEnclave.start();

    // Create clients
    const vsockConfig: VsockConfig = {
      cid: 3,
      port: 3000,
      timeoutMs: 5000,
      retryAttempts: 3,
      retryDelayMs: 100,
    };

    const l3Config: L3Config = {
      endpoint: l3Endpoint,
      timeoutMs: 5000,
      retryAttempts: 3,
    };

    const authConfig: AuthConfig = {
      enabled: false,
      rateLimitingEnabled: false,
    };

    vsockClient = new UnixSocketClient(vsockConfig, socketPath);
    await vsockClient.connect();

    l3Client = new L3Client(l3Config);
    authModule = new AuthModule(authConfig);

    // Create Express app
    const apiConfig: ApiConfig = {
      host: '0.0.0.0',
      port: 8080,
      tlsEnabled: false,
    };

    app = createServer(apiConfig, {
      vsockClient,
      l3Client,
      authModule,
      tappId: 'test-tapp-e2e',
    });
  });

  afterAll(async () => {
    await vsockClient.disconnect();
    await mockEnclave.stop();
    nock.cleanAll();
  });

  beforeEach(() => {
    mockEnclave.resetRequestCount();
    nock.cleanAll();
  });

  describe('Complete Attestation Workflow', () => {
    it('should complete full attestation flow: enclave → L3 submission', async () => {
      // Mock L3 guardian endpoint
      const mockL3Response = {
        attestation_id: 'att-e2e-123',
        submission_time: new Date().toISOString(),
        status: 'pending',
      };

      nock(l3Endpoint).post('/attestation/submit').reply(200, mockL3Response);

      // Step 1: Get attestation from enclave via host API
      const attestResponse = await request(app).post('/api/v1/attest').send({
        tappId: 'test-tapp-workflow',
      });

      expect(attestResponse.status).toBe(200);
      expect(attestResponse.body).toMatchObject({
        attestationDoc: expect.any(String),
        certificateChain: expect.arrayContaining([expect.any(String)]),
        publicKey: expect.any(String),
        tappId: 'test-tapp-workflow',
      });

      // Step 2: Verify enclave was called
      expect(mockEnclave.getRequestCount()).toBe(1);

      // Step 3: Verify L3 submission was attempted (mocked)
      expect(nock.isDone()).toBe(true);
    });

    it('should handle L3 submission errors gracefully', async () => {
      // Mock L3 guardian error
      nock(l3Endpoint).post('/attestation/submit').reply(500, { error: 'Guardian unavailable' });

      const attestResponse = await request(app).post('/api/v1/attest').send({
        tappId: 'test-tapp-error',
      });

      // Host should still return attestation even if L3 submission fails
      // (L3 submission happens asynchronously)
      expect(attestResponse.status).toBe(200);
      expect(mockEnclave.getRequestCount()).toBe(1);
    });
  });

  describe('Transaction Signing Workflow', () => {
    it('should sign transaction and verify signature format', async () => {
      const transactionData = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        value: '1000000000000000000', // 1 ETH in wei
        data: '0x',
      };

      const response = await request(app)
        .post('/api/v1/request')
        .send({
          method: 'sign_transaction',
          params: {
            data: JSON.stringify(transactionData),
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          signature: expect.stringMatching(/^0x[a-f0-9]{64}$/),
        },
        signature: expect.stringMatching(/^0x[a-f0-9]{64}$/),
      });

      // Verify signature is deterministic for same input
      const response2 = await request(app)
        .post('/api/v1/request')
        .send({
          method: 'sign_transaction',
          params: {
            data: JSON.stringify(transactionData),
          },
        });

      expect(response2.body.data.signature).toBe(response.body.data.signature);
      expect(mockEnclave.getRequestCount()).toBe(2);
    });

    it('should handle multiple concurrent signing requests', async () => {
      const requests = Array(5)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post('/api/v1/request')
            .send({
              method: 'sign_transaction',
              params: { data: `tx-${i}` },
            })
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockEnclave.getRequestCount()).toBe(5);
    });
  });

  describe('Health Monitoring Workflow', () => {
    it('should report healthy when all services available', async () => {
      // Mock L3 health endpoint
      nock(l3Endpoint).get('/health').reply(200, { status: 'ok' });

      const healthResponse = await request(app).get('/api/v1/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body).toMatchObject({
        status: 'healthy',
        enclaveConnected: true,
        l3Reachable: true,
      });
    });

    it('should report unhealthy when L3 is unreachable', async () => {
      // Mock L3 health endpoint failure
      nock(l3Endpoint).get('/health').replyWithError('Connection refused');

      const healthResponse = await request(app).get('/api/v1/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body).toMatchObject({
        status: 'unhealthy',
        enclaveConnected: true,
        l3Reachable: false,
      });
    });

    it('should track metrics over time', async () => {
      // Make several requests
      await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });
      await request(app).post('/api/v1/request').send({
        method: 'get_public_key',
        params: {},
      });
      await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });

      // Check status
      const statusResponse = await request(app).get('/api/v1/status');

      expect(statusResponse.body.requestsProcessed).toBeGreaterThanOrEqual(3);
      expect(statusResponse.body.uptimeSeconds).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/request')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should continue serving after errors', async () => {
      // Send invalid request
      await request(app).post('/api/v1/request').send({
        method: 'unknown_method',
        params: {},
      });

      // Valid request should still work
      const validResponse = await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });

      expect(validResponse.status).toBe(200);
      expect(validResponse.body.success).toBe(true);
    });
  });

  describe('Performance and Load', () => {
    it('should handle burst of requests', async () => {
      const startTime = Date.now();
      const requestCount = 20;

      const requests = Array(requestCount)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post('/api/v1/request')
            .send({
              method: 'ping',
              params: { index: i },
            })
        );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete in reasonable time (< 5 seconds for 20 requests)
      expect(duration).toBeLessThan(5000);

      expect(mockEnclave.getRequestCount()).toBe(requestCount);
    });
  });
});
