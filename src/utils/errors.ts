/**
 * Custom error classes for ORBS TEE Host
 */

export class HostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class VsocketError extends HostError {
  constructor(message: string) {
    super(message);
    this.name = 'VsocketError';
  }
}

export class L3Error extends HostError {
  constructor(message: string) {
    super(message);
    this.name = 'L3Error';
  }
}

export class AuthError extends HostError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ConfigError extends HostError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
