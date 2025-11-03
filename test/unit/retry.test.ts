/**
 * Unit tests for retry utility
 */

import { retryWithBackoff } from '../../src/utils/retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxAttempts: 3,
      delayMs: 10,
      backoffMultiplier: 2,
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxAttempts: 3,
      delayMs: 10,
      backoffMultiplier: 2,
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max attempts', async () => {
    const error = new Error('Persistent failure');
    const operation = jest.fn().mockRejectedValue(error);

    await expect(
      retryWithBackoff(operation, {
        maxAttempts: 3,
        delayMs: 10,
        backoffMultiplier: 2,
      })
    ).rejects.toThrow('Persistent failure');

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should apply exponential backoff', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const startTime = Date.now();
    await retryWithBackoff(operation, {
      maxAttempts: 3,
      delayMs: 100,
      backoffMultiplier: 2,
    });
    const duration = Date.now() - startTime;

    // First retry: 100ms, second retry: 200ms = ~300ms total
    // Allow some margin for timing variance
    expect(duration).toBeGreaterThanOrEqual(250);
    expect(duration).toBeLessThan(400);
  });

  it('should handle single attempt (no retry)', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxAttempts: 1,
      delayMs: 100,
      backoffMultiplier: 2,
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should throw immediately on last attempt', async () => {
    const error = new Error('Final attempt failed');
    const operation = jest.fn().mockRejectedValue(error);

    const startTime = Date.now();
    await expect(
      retryWithBackoff(operation, {
        maxAttempts: 1,
        delayMs: 100,
        backoffMultiplier: 2,
      })
    ).rejects.toThrow('Final attempt failed');
    const duration = Date.now() - startTime;

    // Should fail immediately without delay
    expect(duration).toBeLessThan(50);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
