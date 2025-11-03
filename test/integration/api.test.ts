/**
 * Integration tests for API endpoints
 * Tests the full stack: HTTP API → Host → Mock Enclave
 */

import request from 'supertest';
import { Application } from 'express';
import { MockEnclave } from '../helpers/mock-enclave';
import { createServer } from '../../src/api/server';
import { UnixSocketClient } from '../../src/vsock/client';
import { L3Client } from '../../src/l3/client';
import { AuthModule } from '../../src/auth';
import { ApiConfig, VsockConfig, L3Config, AuthConfig } from '../../src/types';

describe('API Integration Tests', () => {
  let mockEnclave: MockEnclave;
  let app: Application;
  let vsockClient: UnixSocketClient;
  let l3Client: L3Client;
  let authModule: AuthModule;

  const socketPath = '/tmp/enclave-test.sock';

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
      endpoint: 'http://localhost:3001',
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
      tappId: 'test-tapp-123',
    });
  });

  afterAll(async () => {
    await vsockClient.disconnect();
    await mockEnclave.stop();
  });

  beforeEach(() => {
    mockEnclave.resetRequestCount();
  });

  describe('GET /api/v1/health', () => {
    it('should return healthy status when enclave is connected', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        enclaveConnected: true,
        l3Reachable: false, // L3 endpoint not running
        uptimeSeconds: expect.any(Number),
      });
    });

    it('should include uptime in response', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/v1/status', () => {
    it('should return detailed status', async () => {
      const response = await request(app).get('/api/v1/status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        hostVersion: expect.any(String),
        status: expect.stringMatching(/healthy|unhealthy/),
        enclaveConnected: true,
        l3Reachable: false,
        l3GuardiansReachable: 0,
        uptimeSeconds: expect.any(Number),
        requestsProcessed: expect.any(Number),
      });
    });
  });

  describe('POST /api/v1/request', () => {
    it('should forward ping request to enclave', async () => {
      const response = await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        success: true,
        data: {
          pong: true,
          timestamp: expect.any(Number),
        },
      });
      expect(mockEnclave.getRequestCount()).toBe(1);
    });

    it('should get public key from enclave', async () => {
      const response = await request(app).post('/api/v1/request').send({
        method: 'get_public_key',
        params: {},
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          publicKey: expect.stringMatching(/^0x[a-f0-9]+$/),
        },
      });
      expect(mockEnclave.getRequestCount()).toBe(1);
    });

    it('should sign transaction in enclave', async () => {
      const response = await request(app)
        .post('/api/v1/request')
        .send({
          method: 'sign_transaction',
          params: {
            data: 'test-transaction-data',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          signature: expect.stringMatching(/^0x[a-f0-9]+$/),
        },
        signature: expect.stringMatching(/^0x[a-f0-9]+$/),
      });
      expect(mockEnclave.getRequestCount()).toBe(1);
    });

    it('should execute generic command in enclave', async () => {
      const response = await request(app)
        .post('/api/v1/request')
        .send({
          method: 'execute',
          params: {
            command: 'test-command',
            args: ['arg1', 'arg2'],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          result: expect.stringContaining('Executed'),
        },
      });
      expect(mockEnclave.getRequestCount()).toBe(1);
    });

    it('should handle unknown method', async () => {
      const response = await request(app).post('/api/v1/request').send({
        method: 'unknown_method',
        params: {},
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Unknown method'),
      });
      expect(mockEnclave.getRequestCount()).toBe(1);
    });

    it('should validate request format', async () => {
      const response = await request(app).post('/api/v1/request').send({
        // Missing method field
        params: {},
      });

      expect(response.status).toBe(400);
    });

    it('should handle multiple sequential requests', async () => {
      const requests = [
        { method: 'ping', params: {} },
        { method: 'get_public_key', params: {} },
        { method: 'ping', params: {} },
      ];

      for (const req of requests) {
        const response = await request(app).post('/api/v1/request').send(req);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }

      expect(mockEnclave.getRequestCount()).toBe(3);
    });
  });

  describe('POST /api/v1/attest', () => {
    it('should get attestation from enclave', async () => {
      const response = await request(app).post('/api/v1/attest').send({
        tappId: 'test-tapp-456',
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        attestationDoc: expect.any(String),
        certificateChain: expect.arrayContaining([expect.any(String)]),
        publicKey: expect.stringMatching(/^0x[a-f0-9]+$/),
        tappId: 'test-tapp-456',
      });

      // Verify attestationDoc is base64
      expect(() => Buffer.from(response.body.attestationDoc, 'base64')).not.toThrow();

      expect(mockEnclave.getRequestCount()).toBe(1);
    });

    it('should use default tappId if not provided', async () => {
      const response = await request(app).post('/api/v1/attest').send({});

      expect(response.status).toBe(200);
      expect(response.body.tappId).toBe('test-tapp-123'); // Default from server config
      expect(mockEnclave.getRequestCount()).toBe(1);
    });

    it('should handle attestation errors', async () => {
      // TODO: Implement error scenario in mock enclave
      // For now, this test is a placeholder
    });
  });

  describe('Request ID Tracking', () => {
    it('should generate unique request IDs', async () => {
      const response1 = await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });

      const response2 = await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });

      expect(response1.body.id).toBeTruthy();
      expect(response2.body.id).toBeTruthy();
      expect(response1.body.id).not.toBe(response2.body.id);
    });

    it('should track request count in status endpoint', async () => {
      // Make a few requests
      await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });
      await request(app).post('/api/v1/request').send({
        method: 'ping',
        params: {},
      });

      const statusResponse = await request(app).get('/api/v1/status');

      expect(statusResponse.body.requestsProcessed).toBeGreaterThanOrEqual(2);
    });
  });
});
