/**
 * @module transaction-sender
 * Transaction sending with retry logic and structured logging.
 * Currently a stub — Stage B will wire this to the Anchor IDL.
 */

import { MERIDIAN_CONFIG } from '@meridian/shared/constants.js';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('transaction-sender');

/** Interface for sending and confirming on-chain transactions. */
export interface TransactionSender {
  sendAndConfirm(transaction: unknown, signers: unknown[]): Promise<string>;
}

/** Result of a transaction send attempt. */
export interface TransactionResult {
  readonly signature: string;
  readonly attempts: number;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a stub TransactionSender that logs what would happen.
 * Stage B will replace this with a real Solana transaction sender.
 */
export function createStubTransactionSender(): TransactionSender {
  async function sendAndConfirm(
    transaction: unknown,
    signers: unknown[],
  ): Promise<string> {
    const maxRetries = MERIDIAN_CONFIG.MAX_RETRIES_PER_MARKET;
    const delay = MERIDIAN_CONFIG.INTER_TX_DELAY_MS;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info('sendAndConfirm', `[STUB] Attempt ${attempt}/${maxRetries}`, {
        context: {
          transactionType: typeof transaction,
          signerCount: signers.length,
        },
      });

      // Simulate transaction sending
      const mockSignature = `stub-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      logger.info('sendAndConfirm', `[STUB] Transaction would be sent`, {
        context: {
          signature: mockSignature,
          attempt,
        },
      });

      // In stub mode, always succeed on first attempt
      return mockSignature;

      // In real implementation, retry logic would continue here on failure
      // await sleep(delay);
    }

    // This line is unreachable in stub mode but satisfies the type system
    throw new Error('All transaction attempts exhausted');
  }

  return { sendAndConfirm };
}

/**
 * Execute a transaction with full retry logic.
 * Returns a TransactionResult with attempt count and status.
 */
export async function executeWithRetry(
  sender: TransactionSender,
  transaction: unknown,
  signers: unknown[],
  label: string,
): Promise<TransactionResult> {
  const maxRetries = MERIDIAN_CONFIG.MAX_RETRIES_PER_MARKET;
  const delay = MERIDIAN_CONFIG.INTER_TX_DELAY_MS;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info('executeWithRetry', `Sending ${label} (attempt ${attempt}/${maxRetries})`);

      const signature = await sender.sendAndConfirm(transaction, signers);

      logger.info('executeWithRetry', `${label} confirmed`, {
        context: { signature, attempt },
      });

      return Object.freeze({
        signature,
        attempts: attempt,
        success: true,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn('executeWithRetry', `${label} attempt ${attempt} failed: ${errorMsg}`, {
        error: err,
      });

      if (attempt < maxRetries) {
        await sleep(delay);
      }
    }
  }

  const errorMsg = `${label} failed after ${maxRetries} attempts`;
  logger.error('executeWithRetry', errorMsg);

  return Object.freeze({
    signature: '',
    attempts: maxRetries,
    success: false,
    error: errorMsg,
  });
}
