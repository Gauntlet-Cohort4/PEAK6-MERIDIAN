/**
 * @module tx/redeem
 * Build a redeem transaction that burns outcome tokens after settlement
 * and returns USDC to the trader.
 */

import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
import {
  getMeridianProgram,
  deriveYesMintPda,
  deriveNoMintPda,
  deriveVaultPda,
  deriveAta,
  TOKEN_PROGRAM_ID,
  USDC_MINT,
} from './program';
import type {
  RedeemParams,
  WalletConnection,
  BuildTransactionResult,
  UnsignedTransaction,
} from './types';

/**
 * Validate redeem parameters before building the transaction.
 */
function validateRedeemParams(params: RedeemParams): void {
  if (!params.marketAddress || params.marketAddress.length === 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Market address is required for redeem',
    );
  }

  if (params.tokenType !== 'yes' && params.tokenType !== 'no') {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Token type must be "yes" or "no"',
      undefined,
      { tokenType: params.tokenType },
    );
  }
}

/**
 * Build a redeem transaction (sync stub).
 *
 * @deprecated Use buildRedeemInstruction() instead. This sync version produces
 * a stub with recentBlockhash='FETCH_VIA_CONNECTION' that cannot be submitted
 * directly. It exists only for offline account derivation / UI previews.
 */
export function buildRedeemTransaction(
  params: RedeemParams,
  wallet: WalletConnection,
): BuildTransactionResult {
  validateRedeemParams(params);

  debugLog('TX_BUILDING', 'redeem', 'build', 'Building redeem transaction', {
    marketAddress: params.marketAddress,
    tokenType: params.tokenType,
    wallet: wallet.publicKey,
  });

  const userPubkey = new PublicKey(wallet.publicKey);
  const strikeMarket = new PublicKey(params.marketAddress);

  // Derive PDAs
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  const userUsdc = deriveAta(userPubkey, USDC_MINT);
  const userYes = deriveAta(userPubkey, yesMint);
  const userNo = deriveAta(userPubkey, noMint);

  const redeemYes = params.tokenType === 'yes';
  if (params.amount === undefined || params.amount <= 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Amount is required and must be greater than zero for redeem',
    );
  }
  const amount = params.amount;

  const program = getMeridianProgram();

  const accounts = [
    { pubkey: userPubkey.toBase58(), isSigner: true, isWritable: true },
    { pubkey: strikeMarket.toBase58(), isSigner: false, isWritable: true },
    { pubkey: yesMint.toBase58(), isSigner: false, isWritable: true },
    { pubkey: noMint.toBase58(), isSigner: false, isWritable: true },
    { pubkey: userYes.toBase58(), isSigner: false, isWritable: true },
    { pubkey: userNo.toBase58(), isSigner: false, isWritable: true },
    { pubkey: userUsdc.toBase58(), isSigner: false, isWritable: true },
    { pubkey: vault.toBase58(), isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false },
  ];

  const stubInstruction = {
    programId: program.programId.toBase58(),
    keys: accounts,
    data: encodeRedeemData(amount, redeemYes),
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
 */
export async function buildRedeemInstruction(
  params: RedeemParams,
  walletPubkey: PublicKey,
): Promise<import('@solana/web3.js').TransactionInstruction> {
  validateRedeemParams(params);

  const strikeMarket = new PublicKey(params.marketAddress);
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  const userUsdc = deriveAta(walletPubkey, USDC_MINT);
  const userYes = deriveAta(walletPubkey, yesMint);
  const userNo = deriveAta(walletPubkey, noMint);

  const redeemYes = params.tokenType === 'yes';
  if (params.amount === undefined || params.amount <= 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Amount is required and must be greater than zero for redeem',
    );
  }
  const program = getMeridianProgram();

  return program.methods
    .redeem(new BN(params.amount), redeemYes)
    .accountsPartial({
      user: walletPubkey,
      strikeMarket,
      yesMint,
      noMint,
      userYes,
      userNo,
      userUsdc,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/** Encode redeem instruction data: 8-byte discriminator + u64 amount + bool redeem_yes. */
function encodeRedeemData(amount: number, redeemYes: boolean): Uint8Array {
  // Discriminator from IDL: [184, 12, 86, 149, 70, 196, 97, 225]
  const discriminator = [184, 12, 86, 149, 70, 196, 97, 225];
  const amountBytes = new BN(amount).toArray('le', 8);
  const yesByte = redeemYes ? 1 : 0;
  return new Uint8Array([...discriminator, ...amountBytes, yesByte]);
}
