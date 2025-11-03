/**
 * Unit tests for error classes
 */

import { HostError, VsocketError, L3Error, AuthError, ConfigError } from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('HostError', () => {
    it('should create error with correct message', () => {
      const error = new HostError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('HostError');
    });

    it('should be instance of Error', () => {
      const error = new HostError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HostError);
    });

    it('should have stack trace', () => {
      const error = new HostError('Test error');
      expect(error.stack).toBeDefined();
    });
  });

  describe('VsocketError', () => {
    it('should create error with correct message', () => {
      const error = new VsocketError('Connection failed');
      expect(error.message).toBe('Connection failed');
      expect(error.name).toBe('VsocketError');
    });

    it('should be instance of HostError', () => {
      const error = new VsocketError('Test');
      expect(error).toBeInstanceOf(HostError);
      expect(error).toBeInstanceOf(VsocketError);
    });
  });

  describe('L3Error', () => {
    it('should create error with correct message', () => {
      const error = new L3Error('Guardian unreachable');
      expect(error.message).toBe('Guardian unreachable');
      expect(error.name).toBe('L3Error');
    });

    it('should be instance of HostError', () => {
      const error = new L3Error('Test');
      expect(error).toBeInstanceOf(HostError);
      expect(error).toBeInstanceOf(L3Error);
    });
  });

  describe('AuthError', () => {
    it('should create error with correct message', () => {
      const error = new AuthError('Unauthorized');
      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('AuthError');
    });

    it('should be instance of HostError', () => {
      const error = new AuthError('Test');
      expect(error).toBeInstanceOf(HostError);
      expect(error).toBeInstanceOf(AuthError);
    });
  });

  describe('ConfigError', () => {
    it('should create error with correct message', () => {
      const error = new ConfigError('Invalid config');
      expect(error.message).toBe('Invalid config');
      expect(error.name).toBe('ConfigError');
    });

    it('should be instance of HostError', () => {
      const error = new ConfigError('Test');
      expect(error).toBeInstanceOf(HostError);
      expect(error).toBeInstanceOf(ConfigError);
    });
  });
});
