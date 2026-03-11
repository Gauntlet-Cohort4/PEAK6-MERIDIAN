/**
 * @module transaction-sender
 * Transaction sending with retry logic and structured logging.
 * Supports both stub mode (DEMO_MODE=true) and real Solana transactions.
 */

import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { MERIDIAN_CONFIG } from '@meridian/shared/constants.js';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('transaction-sender');

/** Interface for sending and confirming on-chain transactions. */
export interface TransactionSender {
  sendAndConfirm(
    instruction: TransactionInstruction,
    signers: readonly Keypair[],
  ): Promise<string>;
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
 * Used when DEMO_MODE is true.
 */
export function createStubTransactionSender(): TransactionSender {
  async function sendAndConfirm(
    _instruction: TransactionInstruction | unknown,
    _signers: readonly Keypair[] | unknown[],
  ): Promise<string> {
    const mockSignature = `stub-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info('sendAndConfirm', '[STUB] Transaction would be sent', {
      context: { signature: mockSignature },
    });

    return mockSignature;
  }

  return { sendAndConfirm } as TransactionSender;
}

/** Dependencies for creating a real Solana transaction sender. */
export interface RealTransactionSenderDeps {
  readonly connection: Connection;
}

/**
 * Create a real TransactionSender that sends transactions to Solana.
 * Used when DEMO_MODE is false.
 */
export function createRealTransactionSender(
  deps: RealTransactionSenderDeps,
): TransactionSender {
  const { connection } = deps;

  async function sendAndConfirm(
    instruction: TransactionInstruction,
    signers: readonly Keypair[],
  ): Promise<string> {
    const maxRetries = MERIDIAN_CONFIG.MAX_RETRIES_PER_MARKET;
    const delay = MERIDIAN_CONFIG.INTER_TX_DELAY_MS;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('sendAndConfirm', `Attempt ${attempt}/${maxRetries}`, {
          context: { signerCount: signers.length },
        });

        const transaction = new Transaction().add(instruction);

        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = signers[0]?.publicKey;

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [...signers],
          { commitment: 'confirmed' },
        );

        logger.info('sendAndConfirm', `Transaction confirmed`, {
          context: { signature, attempt },
        });

        return signature;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.warn('sendAndConfirm', `Attempt ${attempt} failed: ${errorMsg}`, {
          error: err,
        });

        if (attempt < maxRetries) {
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`All ${maxRetries} transaction attempts exhausted`);
  }

  return { sendAndConfirm };
}

/**
 * Execute a transaction with structured result tracking.
 * Note: sendAndConfirm already retries internally — this wrapper
 * provides a TransactionResult envelope, NOT additional retries.
 */
export async function executeWithResult(
  sender: TransactionSender,
  instruction: TransactionInstruction,
  signers: readonly Keypair[],
  label: string,
): Promise<TransactionResult> {
  try {
    logger.info('executeWithResult', `Sending ${label}`);

    const signature = await sender.sendAndConfirm(instruction, signers);

    logger.info('executeWithResult', `${label} confirmed`, {
      context: { signature },
    });

    return Object.freeze({
      signature,
      attempts: 1,
      success: true,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('executeWithResult', `${label} failed: ${errorMsg}`, {
      error: err,
    });

    return Object.freeze({
      signature: '',
      attempts: 1,
      success: false,
      error: errorMsg,
    });
  }
}
