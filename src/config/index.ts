/**
 * Configuration management
 * Loads configuration from JSON file and environment variables
 */

import * as fs from 'fs';
import * as path from 'path';
import Joi from 'joi';
import { Config } from '../types';
import { ConfigError } from '../utils/errors';
import logger from '../utils/logger';

const configSchema = Joi.object({
  vsock: Joi.object({
    cid: Joi.number().required(),
    port: Joi.number().required(),
    timeoutMs: Joi.number().default(30000),
    retryAttempts: Joi.number().default(5),
    retryDelayMs: Joi.number().default(100),
  }).required(),
  l3: Joi.object({
    endpoint: Joi.string().uri().required(),
    timeoutMs: Joi.number().default(30000),
    retryAttempts: Joi.number().default(3),
  }).required(),
  api: Joi.object({
    host: Joi.string().default('0.0.0.0'),
    port: Joi.number().default(8080),
    tlsEnabled: Joi.boolean().default(false),
    tlsCert: Joi.string().optional(),
    tlsKey: Joi.string().optional(),
  }).required(),
  auth: Joi.object({
    enabled: Joi.boolean().default(false),
    rateLimitingEnabled: Joi.boolean().default(false),
  }).required(),
  logging: Joi.object({
    level: Joi.string()
      .valid('error', 'warn', 'info', 'debug')
      .default('info'),
    format: Joi.string().valid('json', 'pretty').default('json'),
  }).required(),
});

export function loadConfig(configPath?: string): Config {
  // Determine config file path
  const filePath =
    configPath ||
    process.env.CONFIG_PATH ||
    path.join(process.cwd(), 'config.json');

  logger.info('Loading configuration', { filePath });

  // Load from file
  let baseConfig: any;
  try {
    const configFile = fs.readFileSync(filePath, 'utf-8');
    baseConfig = JSON.parse(configFile);
  } catch (error) {
    throw new ConfigError(
      `Failed to load config file: ${(error as Error).message}`
    );
  }

  // Override with environment variables
  const config = {
    ...baseConfig,
    vsock: {
      ...baseConfig.vsock,
      cid: process.env.VSOCK_CID
        ? parseInt(process.env.VSOCK_CID)
        : baseConfig.vsock.cid,
      port: process.env.VSOCK_PORT
        ? parseInt(process.env.VSOCK_PORT)
        : baseConfig.vsock.port,
    },
    l3: {
      ...baseConfig.l3,
      endpoint: process.env.L3_ENDPOINT || baseConfig.l3.endpoint,
    },
    api: {
      ...baseConfig.api,
      host: process.env.API_HOST || baseConfig.api.host,
      port: process.env.API_PORT
        ? parseInt(process.env.API_PORT)
        : baseConfig.api.port,
    },
    logging: {
      ...baseConfig.logging,
      level: process.env.LOG_LEVEL || baseConfig.logging.level,
      format: process.env.LOG_FORMAT || baseConfig.logging.format,
    },
  };

  // Validate
  const { error, value } = configSchema.validate(config);
  if (error) {
    throw new ConfigError(`Config validation failed: ${error.message}`);
  }

  logger.info('Configuration loaded successfully', {
    apiPort: value.api.port,
    vsockPort: value.vsock.port,
    logLevel: value.logging.level,
  });

  return value as Config;
}
