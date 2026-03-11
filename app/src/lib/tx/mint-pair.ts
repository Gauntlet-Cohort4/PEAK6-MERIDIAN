/**
 * @module tx/mint-pair
 * Build a mint_pair transaction that deposits USDC and receives
 * one YES + one NO token per unit.
 */

import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { MERIDIAN_CONFIG } from '@meridian/shared/constants';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
import {
  getMeridianProgram,
  deriveConfigPda,
  deriveYesMintPda,
  deriveNoMintPda,
  deriveVaultPda,
  deriveAta,
  TOKEN_PROGRAM_ID,
  USDC_MINT,
} from './program';
import type {
  MintPairParams,
  WalletConnection,
  BuildTransactionResult,
  UnsignedTransaction,
} from './types';

/**
 * Validate mint pair parameters before building the transaction.
 */
function validateMintPairParams(params: MintPairParams): void {
  if (!params.marketAddress || params.marketAddress.length === 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Market address is required for mint_pair',
    );
  }

  if (params.amount <= 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Amount must be greater than zero',
      undefined,
      { amount: params.amount },
    );
  }

  if (!Number.isInteger(params.amount)) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Amount must be a whole number of pairs',
      undefined,
      { amount: params.amount },
    );
  }
}

/**
 * Build a mint_pair transaction (sync stub).
 *
 * @deprecated Use buildMintPairInstruction() instead. This sync version produces
 * a stub with recentBlockhash='FETCH_VIA_CONNECTION' that cannot be submitted
 * directly. It exists only for offline account derivation / UI previews.
 */
export function buildMintPairTransaction(
  params: MintPairParams,
  wallet: WalletConnection,
): BuildTransactionResult {
  validateMintPairParams(params);

  const usdcCost = params.amount * MERIDIAN_CONFIG.PAIR_COST_USDC;

  debugLog('TX_BUILDING', 'mint-pair', 'build', 'Building mint_pair transaction', {
    marketAddress: params.marketAddress,
    amount: params.amount,
    usdcCost,
    wallet: wallet.publicKey,
  });

  const userPubkey = new PublicKey(wallet.publicKey);
  const strikeMarket = new PublicKey(params.marketAddress);

  // Derive PDAs
  const [configPda] = deriveConfigPda();
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  // Derive user ATAs
  const userUsdc = deriveAta(userPubkey, USDC_MINT);
  const userYes = deriveAta(userPubkey, yesMint);
  const userNo = deriveAta(userPubkey, noMint);

  const program = getMeridianProgram();

  // Sync path builds a stub instruction with hand-derived accounts.
  // Use buildMintPairInstruction() for the real async Anchor path.
  const stubInstruction = {
    programId: program.programId.toBase58(),
    keys: [
      { pubkey: userPubkey.toBase58(), isSigner: true, isWritable: true },
      { pubkey: configPda.toBase58(), isSigner: false, isWritable: false },
      { pubkey: strikeMarket.toBase58(), isSigner: false, isWritable: true },
      { pubkey: yesMint.toBase58(), isSigner: false, isWritable: true },
      { pubkey: noMint.toBase58(), isSigner: false, isWritable: true },
      { pubkey: userUsdc.toBase58(), isSigner: false, isWritable: true },
      { pubkey: userYes.toBase58(), isSigner: false, isWritable: true },
      { pubkey: userNo.toBase58(), isSigner: false, isWritable: true },
      { pubkey: USDC_MINT.toBase58(), isSigner: false, isWritable: false },
      { pubkey: vault.toBase58(), isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false },
    ],
    data: encodeMintPairData(params.amount),
  };

  const transaction: UnsignedTransaction = {
    instructions: [stubInstruction],
    feePayer: wallet.publicKey,
    recentBlockhash: 'FETCH_VIA_CONNECTION',
  };

  return Object.freeze({
    transaction,
    estimatedFee: 5000,
  });
}

/**
 * Async version that returns a fully built Anchor TransactionInstruction.
 * Use this when you have an async context (e.g., inside useTradeActions).
 */
export async function buildMintPairInstruction(
  params: MintPairParams,
  walletPubkey: PublicKey,
): Promise<import('@solana/web3.js').TransactionInstruction> {
  validateMintPairParams(params);

  const strikeMarket = new PublicKey(params.marketAddress);
  const [configPda] = deriveConfigPda();
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  const userUsdc = deriveAta(walletPubkey, USDC_MINT);
  const userYes = deriveAta(walletPubkey, yesMint);
  const userNo = deriveAta(walletPubkey, noMint);

  const program = getMeridianProgram();

  return program.methods
    .mintPair(new BN(params.amount))
    .accountsPartial({
      user: walletPubkey,
      config: configPda,
      strikeMarket,
      yesMint,
      noMint,
      userUsdc,
      userYes,
      userNo,
      usdcMint: USDC_MINT,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/** Encode mint_pair instruction data: 8-byte discriminator + u64 amount. */
function encodeMintPairData(amount: number): Uint8Array {
  // Discriminator from IDL: [19, 149, 94, 110, 181, 186, 33, 107]
  const discriminator = [19, 149, 94, 110, 181, 186, 33, 107];
  const amountBytes = new BN(amount).toArray('le', 8);
  return new Uint8Array([...discriminator, ...amountBytes]);
}
