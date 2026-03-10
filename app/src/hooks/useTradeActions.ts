'use client';

import { useCallback, useState } from 'react';
import type { TradeOrder } from '@meridian/shared/types';
import { TradeSide } from '@meridian/shared/types';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { buildMintPairTransaction } from '@/lib/tx/mint-pair';
import { buildBuyNoTransaction } from '@/lib/tx/buy-no';
import { buildSellNoTransaction } from '@/lib/tx/sell-no';
import { buildRedeemTransaction } from '@/lib/tx/redeem';
import type { WalletConnection, BuildTransactionResult } from '@/lib/tx/types';

export interface UseTradeActionsResult {
  readonly submitOrder: (order: TradeOrder) => Promise<string>;
  readonly isSubmitting: boolean;
  readonly lastError: string | null;
  readonly lastTxSignature: string | null;
}

/**
 * Build the appropriate transaction based on the trade side.
 */
function buildTransactionForOrder(
  order: TradeOrder,
  wallet: WalletConnection,
): BuildTransactionResult {
  switch (order.side) {
    case TradeSide.BUY_YES:
      return buildMintPairTransaction(
        { marketAddress: order.marketAddress, amount: order.size },
        wallet,
      );
    case TradeSide.BUY_NO:
      return buildBuyNoTransaction(
        { marketAddress: order.marketAddress, maxUsdc: order.size * order.price },
        wallet,
      );
    case TradeSide.SELL_NO:
      return buildSellNoTransaction(
        { marketAddress: order.marketAddress },
        wallet,
      );
    case TradeSide.SELL_YES:
      return buildRedeemTransaction(
        { marketAddress: order.marketAddress, tokenType: 'yes' },
        wallet,
      );
    default:
      throw new MeridianError(
        MeridianErrorCode.TRANSACTION_REJECTED,
        `Unsupported trade side: ${String(order.side)}`,
      );
  }
}

/**
 * Hook for trade execution.
 * Builds transactions using tx builders and submits via wallet.
 *
 * TODO: Wire to actual wallet adapter and RPC submission once
 * @solana/wallet-adapter-react is installed.
 */
export function useTradeActions(): UseTradeActionsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

  const submitOrder = useCallback(async (order: TradeOrder): Promise<string> => {
    setIsSubmitting(true);
    setLastError(null);

    try {
      // TODO: Get actual wallet from useWallet() hook
      const stubWallet: WalletConnection = {
        publicKey: order.traderPublicKey,
        signTransaction: async (tx) => ({
          serialized: new Uint8Array([]),
        }),
      };

      const { transaction } = buildTransactionForOrder(order, stubWallet);

      // TODO: Submit signed transaction to RPC
      // const signed = await stubWallet.signTransaction(transaction);
      // const sig = await connection.sendRawTransaction(signed.serialized);
      // await connection.confirmTransaction(sig);

      // Simulate submission for now
      await new Promise((resolve) => setTimeout(resolve, 500));
      const mockSig = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      setLastTxSignature(mockSig);
      return mockSig;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLastError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitOrder, isSubmitting, lastError, lastTxSignature };
}
