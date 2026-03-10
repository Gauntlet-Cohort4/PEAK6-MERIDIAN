/**
 * @module tx/mint-pair
 * Build a mint_pair transaction that deposits USDC and receives
 * one YES + one NO token per unit.
 */

import { MERIDIAN_CONFIG } from '@meridian/shared/constants';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
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
 * Build a mint_pair transaction.
 *
 * The mint_pair instruction deposits `amount * PAIR_COST_USDC` USDC
 * into the vault and mints `amount` YES tokens + `amount` NO tokens
 * to the trader's token accounts.
 *
 * TODO: Replace stub instruction with actual Anchor IDL-based instruction.
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

  // TODO: Build actual instruction using the Meridian IDL:
  // const ix = program.methods
  //   .mintPair(new BN(params.amount))
  //   .accounts({
  //     market: params.marketAddress,
  //     trader: wallet.publicKey,
  //     traderUsdc: getAssociatedTokenAddress(...),
  //     traderYes: getAssociatedTokenAddress(...),
  //     traderNo: getAssociatedTokenAddress(...),
  //     vault: vaultAddress,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //   })
  //   .instruction();

  const stubInstruction = {
    programId: 'MeridianProgram111111111111111111',
    keys: [
      { pubkey: params.marketAddress, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data: new Uint8Array([0x01, ...encodeAmount(params.amount)]),
  };

  const transaction: UnsignedTransaction = {
    instructions: [stubInstruction],
    feePayer: wallet.publicKey,
    recentBlockhash: 'TODO_FETCH_BLOCKHASH',
  };

  return Object.freeze({
    transaction,
    estimatedFee: 5000, // 5000 lamports base fee
  });
}

/** Encode an amount as a simple byte array (stub). */
function encodeAmount(amount: number): number[] {
  const bytes: number[] = [];
  let remaining = amount;
  for (let i = 0; i < 8; i++) {
    bytes.push(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
}
