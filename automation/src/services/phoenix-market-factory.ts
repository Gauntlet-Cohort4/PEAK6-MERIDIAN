/**
 * @module phoenix-market-factory
 * Creates Phoenix DEX markets for Meridian strike markets.
 *
 * Phoenix V1 InitializeMarket is permissionless — any signer can create a market.
 * The YES token mint is used as the base and USDC as the quote.
 */

import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('phoenix-market-factory');

/** Result of creating a Phoenix market. */
export interface PhoenixMarketResult {
  /** The on-chain address of the newly created Phoenix market. */
  readonly phoenixMarketAddress: string;
  /** Transaction signature. */
  readonly signature: string;
}

/** Result of building Phoenix market creation instructions (without sending). */
export interface PhoenixMarketIxResult {
  /** The instructions to include in a transaction. */
  readonly instructions: readonly TransactionInstruction[];
  /** The keypair for the new Phoenix market account (must be included as signer). */
  readonly marketKeypair: Keypair;
  /** The public key of the new Phoenix market. */
  readonly phoenixMarketAddress: string;
}

/** Factory interface for creating Phoenix DEX markets. */
export interface PhoenixMarketFactory {
  /**
   * Create a Phoenix order book market for a YES token (sends its own transaction).
   * @param yesMintAddress - The YES token mint (base asset)
   * @param quoteMintAddress - The USDC mint (quote asset)
   * @returns The new Phoenix market address and tx signature
   */
  createMarket(
    yesMintAddress: string,
    quoteMintAddress: string,
  ): Promise<PhoenixMarketResult>;

  /**
   * Build Phoenix market creation instructions without sending.
   * Used for composing into an atomic transaction with other instructions.
   */
  buildCreateMarketIxs(
    yesMintAddress: string,
    quoteMintAddress: string,
  ): Promise<PhoenixMarketIxResult>;
}

/**
 * Create a stub PhoenixMarketFactory for demo/test mode.
 * Returns mock addresses without touching chain.
 */
export function createStubPhoenixMarketFactory(): PhoenixMarketFactory {
  let counter = 0;

  async function createMarket(
    yesMintAddress: string,
    quoteMintAddress: string,
  ): Promise<PhoenixMarketResult> {
    counter += 1;
    const phoenixMarketAddress = `stub-phoenix-market-${counter}`;
    const signature = `stub-phoenix-sig-${counter}`;

    logger.info('createMarket', `[STUB] Phoenix market created`, {
      context: { phoenixMarketAddress, yesMintAddress, quoteMintAddress, signature },
    });

    return Object.freeze({ phoenixMarketAddress, signature });
  }

  async function buildCreateMarketIxs(
    yesMintAddress: string,
    quoteMintAddress: string,
  ): Promise<PhoenixMarketIxResult> {
    counter += 1;
    const marketKeypair = Keypair.generate();

    logger.info('buildCreateMarketIxs', `[STUB] Built Phoenix market instructions`, {
      context: { phoenixMarket: marketKeypair.publicKey.toBase58(), yesMintAddress, quoteMintAddress },
    });

    return Object.freeze({
      instructions: [
        new TransactionInstruction({
          programId: PublicKey.default,
          keys: [],
          data: Buffer.alloc(0),
        }),
      ],
      marketKeypair,
      phoenixMarketAddress: marketKeypair.publicKey.toBase58(),
    });
  }

  return Object.freeze({ createMarket, buildCreateMarketIxs });
}
