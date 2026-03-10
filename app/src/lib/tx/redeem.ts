/**
 * @module tx/redeem
 * Build a redeem transaction that burns outcome tokens after settlement
 * and returns USDC to the trader.
 */

import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
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
 * Build a redeem transaction.
 *
 * After a market is settled, holders of the winning outcome token
 * can redeem each token for 1 USDC. Losing tokens are burned for 0.
 *
 * TODO: Replace stub instruction with actual Anchor IDL-based instruction.
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

  // TODO: Build actual instruction using the Meridian IDL:
  // 1. Verify market is in SETTLED status
  // 2. Look up trader's token balance for the specified token type
  // 3. Build redeem instruction that burns tokens and transfers USDC
  //
  // const ix = program.methods
  //   .redeem()
  //   .accounts({
  //     market: params.marketAddress,
  //     trader: wallet.publicKey,
  //     traderToken: getAssociatedTokenAddress(
  //       wallet.publicKey,
  //       params.tokenType === 'yes' ? yesTokenMint : noTokenMint,
  //     ),
  //     traderUsdc: getAssociatedTokenAddress(wallet.publicKey, usdcMint),
  //     vault: vaultAddress,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //   })
  //   .instruction();

  const tokenTypeFlag = params.tokenType === 'yes' ? 0x01 : 0x00;

  const stubInstruction = {
    programId: 'MeridianProgram111111111111111111',
    keys: [
      { pubkey: params.marketAddress, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data: new Uint8Array([0x04, tokenTypeFlag]),
  };

  const transaction: UnsignedTransaction = {
    instructions: [stubInstruction],
    feePayer: wallet.publicKey,
    recentBlockhash: 'TODO_FETCH_BLOCKHASH',
  };

  return Object.freeze({
    transaction,
    estimatedFee: 5000,
  });
}
