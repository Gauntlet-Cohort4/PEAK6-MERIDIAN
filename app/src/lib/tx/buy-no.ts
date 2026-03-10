/**
 * @module tx/buy-no
 * Build a buy_no_market transaction that purchases NO tokens
 * from the Phoenix order book using USDC.
 */

import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
import type {
  BuyNoParams,
  WalletConnection,
  BuildTransactionResult,
  UnsignedTransaction,
} from './types';

/**
 * Validate buy NO parameters before building the transaction.
 */
function validateBuyNoParams(params: BuyNoParams): void {
  if (!params.marketAddress || params.marketAddress.length === 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Market address is required for buy_no',
    );
  }

  if (params.maxUsdc <= 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Max USDC must be greater than zero',
      undefined,
      { maxUsdc: params.maxUsdc },
    );
  }
}

/**
 * Build a buy_no_market transaction.
 *
 * This instruction places a market buy order on the Phoenix DEX
 * for NO tokens, spending up to `maxUsdc` USDC.
 *
 * TODO: Replace stub instruction with actual Anchor IDL + Phoenix SDK integration.
 */
export function buildBuyNoTransaction(
  params: BuyNoParams,
  wallet: WalletConnection,
): BuildTransactionResult {
  validateBuyNoParams(params);

  debugLog('TX_BUILDING', 'buy-no', 'build', 'Building buy_no_market transaction', {
    marketAddress: params.marketAddress,
    maxUsdc: params.maxUsdc,
    wallet: wallet.publicKey,
  });

  // TODO: Build actual instruction using Phoenix SDK + Meridian IDL:
  // 1. Look up the Phoenix market for this strike market's NO token
  // 2. Build a Phoenix new_order instruction for a market buy
  // 3. Wrap it in the Meridian buy_no_market CPI instruction
  //
  // const phoenixIx = phoenixSdk.createMarketBuyInstruction({
  //   market: phoenixMarketAddress,
  //   trader: wallet.publicKey,
  //   maxQuoteQty: params.maxUsdc,
  // });

  const stubInstruction = {
    programId: 'MeridianProgram111111111111111111',
    keys: [
      { pubkey: params.marketAddress, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data: new Uint8Array([0x02, ...encodeUsdc(params.maxUsdc)]),
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

/** Encode a USDC amount as a simple byte array (stub). */
function encodeUsdc(amount: number): number[] {
  const bytes: number[] = [];
  let remaining = Math.floor(amount);
  for (let i = 0; i < 8; i++) {
    bytes.push(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
}
