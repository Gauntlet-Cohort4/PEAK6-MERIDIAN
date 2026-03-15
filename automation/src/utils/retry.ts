/**
 * @module retry
 * Generic retry utility with exponential backoff.
 */

import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('retry');

/** Configuration for retry behavior. */
export interface RetryOptions {
  /** Maximum number of retry attempts. */
  readonly maxAttempts: number;
  /** Initial delay in milliseconds. */
  readonly initialDelayMs: number;
  /** Maximum delay cap in milliseconds. */
  readonly maxDelayMs: number;
  /** Multiplier for exponential backoff (default 2). */
  readonly backoffMultiplier?: number;
  /** Operation name for logging. */
  readonly operationName: string;
}

/**
 * Execute an async operation with exponential backoff retry.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the successful function call
 * @throws The last error if all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier = 2,
    operationName,
  } = options;

  let lastError: Error | unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (attempt === maxAttempts) {
        logger.error('withRetry', `${operationName}: all ${maxAttempts} attempts failed`, {
          error: err,
          context: { attempt, maxAttempts },
        });
        break;
      }

      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs,
      );

      logger.warn('withRetry', `${operationName}: attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`, {
        context: { attempt, maxAttempts, delay, error: errorMsg },
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
