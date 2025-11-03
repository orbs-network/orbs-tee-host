/**
 * Unit tests for configuration loading
 */

import * as fs from 'fs';
import { loadConfig } from '../../src/config';
import { ConfigError } from '../../src/utils/errors';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('loadConfig', () => {
  const validConfig = {
    vsock: {
      cid: 3,
      port: 3000,
      timeoutMs: 30000,
      retryAttempts: 5,
      retryDelayMs: 100,
    },
    l3: {
      endpoint: 'http://localhost:3001',
      timeoutMs: 30000,
      retryAttempts: 3,
    },
    api: {
      host: '0.0.0.0',
      port: 8080,
      tlsEnabled: false,
    },
    auth: {
      enabled: false,
      rateLimitingEnabled: false,
    },
    logging: {
      level: 'info',
      format: 'json',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.CONFIG_PATH;
    delete process.env.VSOCK_CID;
    delete process.env.VSOCK_PORT;
    delete process.env.L3_ENDPOINT;
    delete process.env.API_HOST;
    delete process.env.API_PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
  });

  it('should load valid configuration from file', () => {
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    const config = loadConfig('/test/config.json');

    expect(config).toEqual(validConfig);
    expect(mockedFs.readFileSync).toHaveBeenCalledWith('/test/config.json', 'utf-8');
  });

  it('should use default config path if not specified', () => {
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    loadConfig();

    expect(mockedFs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      'utf-8'
    );
  });

  it('should use CONFIG_PATH environment variable', () => {
    process.env.CONFIG_PATH = '/custom/path/config.json';
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    loadConfig();

    expect(mockedFs.readFileSync).toHaveBeenCalledWith('/custom/path/config.json', 'utf-8');
  });

  it('should override vsock config with environment variables', () => {
    process.env.VSOCK_CID = '5';
    process.env.VSOCK_PORT = '4000';
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    const config = loadConfig('/test/config.json');

    expect(config.vsock.cid).toBe(5);
    expect(config.vsock.port).toBe(4000);
  });

  it('should override L3 endpoint with environment variable', () => {
    process.env.L3_ENDPOINT = 'http://custom-l3:3001';
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    const config = loadConfig('/test/config.json');

    expect(config.l3.endpoint).toBe('http://custom-l3:3001');
  });

  it('should override API config with environment variables', () => {
    process.env.API_HOST = '127.0.0.1';
    process.env.API_PORT = '9000';
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    const config = loadConfig('/test/config.json');

    expect(config.api.host).toBe('127.0.0.1');
    expect(config.api.port).toBe(9000);
  });

  it('should override logging config with environment variables', () => {
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_FORMAT = 'pretty';
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    const config = loadConfig('/test/config.json');

    expect(config.logging.level).toBe('debug');
    expect(config.logging.format).toBe('pretty');
  });

  it('should throw ConfigError if file cannot be read', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    expect(() => loadConfig('/test/config.json')).toThrow(ConfigError);
    expect(() => loadConfig('/test/config.json')).toThrow(/Failed to load config file/);
  });

  it('should throw ConfigError if JSON is invalid', () => {
    mockedFs.readFileSync.mockReturnValue('{ invalid json }');

    expect(() => loadConfig('/test/config.json')).toThrow(ConfigError);
  });

  it('should throw ConfigError if validation fails', () => {
    const invalidConfig = {
      ...validConfig,
      vsock: {
        // Missing required fields
        cid: 3,
      },
    };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

    expect(() => loadConfig('/test/config.json')).toThrow(ConfigError);
    expect(() => loadConfig('/test/config.json')).toThrow(/Config validation failed/);
  });

  it('should apply default values for optional fields', () => {
    const minimalConfig = {
      vsock: {
        cid: 3,
        port: 3000,
      },
      l3: {
        endpoint: 'http://localhost:3001',
      },
      api: {},
      auth: {},
      logging: {},
    };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(minimalConfig));

    const config = loadConfig('/test/config.json');

    expect(config.vsock.timeoutMs).toBe(30000);
    expect(config.vsock.retryAttempts).toBe(5);
    expect(config.l3.timeoutMs).toBe(30000);
    expect(config.api.host).toBe('0.0.0.0');
    expect(config.api.port).toBe(8080);
    expect(config.logging.level).toBe('info');
  });
});
