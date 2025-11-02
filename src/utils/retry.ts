/**
 * Retry utility with exponential backoff
 */

import logger from './logger';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined;
  let delay = options.delayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < options.maxAttempts) {
        logger.debug('Operation failed, retrying', {
          attempt,
          maxAttempts: options.maxAttempts,
          delay,
          error: lastError.message,
        });

        if (options.onRetry) {
          options.onRetry(attempt, lastError);
        }

        await sleep(delay);
        delay *= options.backoffMultiplier;
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
