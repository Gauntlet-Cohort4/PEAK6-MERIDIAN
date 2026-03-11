/**
 * @module tx/types
 * Transaction builder parameter types for the Meridian frontend.
 * Each builder accepts these params plus a wallet connection.
 */

import type { PublicKey } from '@solana/web3.js';

/** Parameters for minting a YES+NO token pair. */
export interface MintPairParams {
  readonly marketAddress: string;
  readonly amount: number;
}

/** Parameters for buying NO tokens on the open market. */
export interface BuyNoParams {
  readonly marketAddress: string;
  readonly maxUsdc: number;
}

/** Parameters for selling NO tokens on the open market. */
export interface SellNoParams {
  readonly marketAddress: string;
  /** Number of NO tokens to sell. Required by the on-chain sell_no instruction. */
  readonly amount: number;
}

/** Parameters for redeeming outcome tokens after settlement. */
export interface RedeemParams {
  readonly marketAddress: string;
  readonly tokenType: 'yes' | 'no';
  /** Number of tokens to redeem. Required by the on-chain redeem instruction. */
  readonly amount: number;
}

/** A wallet connection that can sign transactions. */
export interface WalletConnection {
  readonly publicKey: string;
  readonly signTransaction: (tx: UnsignedTransaction) => Promise<SignedTransaction>;
}

/**
 * Placeholder for an unsigned Solana transaction.
 * TODO: Replace with actual Transaction type from @solana/web3.js
 */
export interface UnsignedTransaction {
  readonly instructions: readonly TransactionInstruction[];
  readonly feePayer: string;
  readonly recentBlockhash: string;
}

/**
 * Placeholder for a signed transaction.
 * TODO: Replace with actual signed Transaction type.
 */
export interface SignedTransaction {
  readonly serialized: Uint8Array;
}

/**
 * Placeholder for a transaction instruction.
 * TODO: Replace with actual TransactionInstruction type.
 */
export interface TransactionInstruction {
  readonly programId: string;
  readonly keys: readonly AccountMeta[];
  readonly data: Uint8Array;
}

/** Account metadata for a transaction instruction. */
export interface AccountMeta {
  readonly pubkey: string;
  readonly isSigner: boolean;
  readonly isWritable: boolean;
}

/** Result of building a transaction. */
export interface BuildTransactionResult {
  readonly transaction: UnsignedTransaction;
  readonly estimatedFee: number;
}

// ── Anchor-aware types (used internally by builders) ────────────────────

/**
 * On-chain accounts needed to resolve PDAs for strike-market instructions.
 * Passed to builders that need Phoenix market and USDC mint addresses.
 */
export interface MarketAccounts {
  /** The strike market PDA address. */
  readonly strikeMarket: PublicKey;
  /** The USDC mint address. */
  readonly usdcMint: PublicKey;
  /** The Phoenix market address for this strike. */
  readonly phoenixMarket: PublicKey;
  /** Phoenix base vault (YES token vault on Phoenix side). */
  readonly phoenixBaseVault: PublicKey;
  /** Phoenix quote vault (USDC vault on Phoenix side). */
  readonly phoenixQuoteVault: PublicKey;
  /** PDA-owned YES token account for CPI trading. */
  readonly pdaYesAccount: PublicKey;
  /** PDA-owned quote (USDC) token account for CPI trading. */
  readonly pdaQuoteAccount: PublicKey;
}
