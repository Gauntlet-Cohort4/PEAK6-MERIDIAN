/**
 * @module tx/sell-no
 * Build a sell_no transaction that sells NO tokens
 * on the Phoenix order book for USDC.
 */

import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
import type {
  SellNoParams,
  WalletConnection,
  BuildTransactionResult,
  UnsignedTransaction,
} from './types';

/**
 * Validate sell NO parameters before building the transaction.
 */
function validateSellNoParams(params: SellNoParams): void {
  if (!params.marketAddress || params.marketAddress.length === 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Market address is required for sell_no',
    );
  }
}

/**
 * Build a sell_no transaction.
 *
 * This instruction sells the trader's entire NO token position
 * on the Phoenix DEX order book.
 *
 * TODO: Replace stub instruction with actual Anchor IDL + Phoenix SDK integration.
 */
export function buildSellNoTransaction(
  params: SellNoParams,
  wallet: WalletConnection,
): BuildTransactionResult {
  validateSellNoParams(params);

  debugLog('TX_BUILDING', 'sell-no', 'build', 'Building sell_no transaction', {
    marketAddress: params.marketAddress,
    wallet: wallet.publicKey,
  });

  // TODO: Build actual instruction using Phoenix SDK + Meridian IDL:
  // 1. Look up trader's NO token balance
  // 2. Look up the Phoenix market for this strike market's NO token
  // 3. Build a Phoenix new_order instruction for a market sell
  // 4. Wrap it in the Meridian sell_no CPI instruction
  //
  // const balance = await getTokenBalance(wallet.publicKey, noTokenMint);
  // const phoenixIx = phoenixSdk.createMarketSellInstruction({
  //   market: phoenixMarketAddress,
  //   trader: wallet.publicKey,
  //   baseQty: balance,
  // });

  const stubInstruction = {
    programId: 'MeridianProgram111111111111111111',
    keys: [
      { pubkey: params.marketAddress, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data: new Uint8Array([0x03]),
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
