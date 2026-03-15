'use client';

import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import type { TradeOrder } from '@meridian/shared/types';
import { TradeSide } from '@meridian/shared/types';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { buildMintPairInstruction, buildMintPairTransaction } from '@/lib/tx/mint-pair';
import { buildRedeemInstruction, buildRedeemTransaction } from '@/lib/tx/redeem';
import { buildBuyNoTransaction } from '@/lib/tx/buy-no';
import { buildSellNoTransaction } from '@/lib/tx/sell-no';
import type { WalletConnection } from '@/lib/tx/types';

/** Whether the app is running in demo mode (no real transactions). */
const IS_DEMO_MODE =
  typeof process !== 'undefined' &&
  process.env?.['NEXT_PUBLIC_DEMO_MODE'] === 'true';

export interface UseTradeActionsResult {
  readonly submitOrder: (order: TradeOrder) => Promise<string>;
  readonly isSubmitting: boolean;
  readonly lastError: string | null;
  readonly lastTxSignature: string | null;
}

/**
 * Get a Connection instance for the configured RPC endpoint.
 */
function getConnection(): Connection {
  const rpcUrl =
    typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SOLANA_RPC_URL']
      ? process.env['NEXT_PUBLIC_SOLANA_RPC_URL']
      : 'https://api.devnet.solana.com';

  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Build the appropriate Anchor instruction for a trade order.
 * Returns a real TransactionInstruction that can be added to a Transaction.
 */
async function buildInstructionForOrder(
  order: TradeOrder,
  walletPubkey: PublicKey,
): Promise<import('@solana/web3.js').TransactionInstruction> {
  switch (order.side) {
    case TradeSide.BUY_YES:
      return buildMintPairInstruction(
        { marketAddress: order.marketAddress, amount: order.size },
        walletPubkey,
      );
    case TradeSide.SELL_YES:
      return buildRedeemInstruction(
        { marketAddress: order.marketAddress, tokenType: 'yes', amount: order.size },
        walletPubkey,
      );
    case TradeSide.REDEEM_YES:
      return buildRedeemInstruction(
        { marketAddress: order.marketAddress, tokenType: 'yes', amount: order.size },
        walletPubkey,
      );
    case TradeSide.REDEEM_NO:
      return buildRedeemInstruction(
        { marketAddress: order.marketAddress, tokenType: 'no', amount: order.size },
        walletPubkey,
      );
    case TradeSide.BUY_NO:
      // BUY_NO requires Phoenix market accounts for the composite
      // mint-pair + sell-YES-on-Phoenix instruction.
      // When Phoenix markets are available, this will use buildBuyNoInstruction().
      throw new MeridianError(
        MeridianErrorCode.TRANSACTION_REJECTED,
        'Buy No requires an active Phoenix order book. Phoenix market integration is pending. Use "Buy Yes" (mint pair) for now.',
      );
    case TradeSide.SELL_NO:
      // SELL_NO requires Phoenix market accounts for the composite
      // buy-YES-on-Phoenix + burn-pair instruction.
      throw new MeridianError(
        MeridianErrorCode.TRANSACTION_REJECTED,
        'Sell No requires an active Phoenix order book. Phoenix market integration is pending. Use "Sell Yes" (redeem) for now.',
      );
    default:
      throw new MeridianError(
        MeridianErrorCode.TRANSACTION_REJECTED,
        `Trade side "${String(order.side)}" is not supported`,
      );
  }
}

/**
 * Build a stub transaction for demo mode preview.
 * Uses the sync builders which produce unsigned stubs.
 */
function buildDemoTransactionForOrder(
  order: TradeOrder,
  wallet: WalletConnection,
): void {
  switch (order.side) {
    case TradeSide.BUY_YES:
      buildMintPairTransaction(
        { marketAddress: order.marketAddress, amount: order.size },
        wallet,
      );
      break;
    case TradeSide.BUY_NO:
      buildBuyNoTransaction(
        { marketAddress: order.marketAddress, maxUsdc: order.size * order.price },
        wallet,
      );
      break;
    case TradeSide.SELL_NO:
      buildSellNoTransaction(
        { marketAddress: order.marketAddress, amount: order.size },
        wallet,
      );
      break;
    case TradeSide.SELL_YES:
      buildRedeemTransaction(
        { marketAddress: order.marketAddress, tokenType: 'yes', amount: order.size },
        wallet,
      );
      break;
    case TradeSide.REDEEM_YES:
      buildRedeemTransaction(
        { marketAddress: order.marketAddress, tokenType: 'yes', amount: order.size },
        wallet,
      );
      break;
    case TradeSide.REDEEM_NO:
      buildRedeemTransaction(
        { marketAddress: order.marketAddress, tokenType: 'no', amount: order.size },
        wallet,
      );
      break;
    default:
      throw new MeridianError(
        MeridianErrorCode.TRANSACTION_REJECTED,
        `Unsupported trade side: ${String(order.side)}`,
      );
  }
}

/**
 * Hook for trade execution.
 *
 * - When NEXT_PUBLIC_DEMO_MODE=true: produces fake signatures for UI preview
 *   (no wallet connection required).
 * - When NEXT_PUBLIC_DEMO_MODE=false (default): builds real Anchor instructions,
 *   signs via the connected wallet adapter, and submits to the configured RPC.
 */
export function useTradeActions(): UseTradeActionsResult {
  const { publicKey, signTransaction, connected } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

  const submitOrder = useCallback(async (order: TradeOrder): Promise<string> => {
    setIsSubmitting(true);
    setLastError(null);

    try {
      // ── Demo mode: fake signature, no wallet needed ──
      if (IS_DEMO_MODE) {
        const stubWallet: WalletConnection = {
          publicKey: order.traderPublicKey,
          signTransaction: async (_tx) => ({
            serialized: new Uint8Array([]),
          }),
        };

        // Run validation / account derivation but discard result
        buildDemoTransactionForOrder(order, stubWallet);

        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockSig = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        setLastTxSignature(mockSig);
        return mockSig;
      }

      // ── Real mode: sign and submit via wallet adapter ──
      if (!connected || !publicKey) {
        throw new MeridianError(
          MeridianErrorCode.TRANSACTION_REJECTED,
          'Wallet is not connected. Please connect your wallet to submit transactions.',
        );
      }

      if (!signTransaction) {
        throw new MeridianError(
          MeridianErrorCode.TRANSACTION_REJECTED,
          'Wallet does not support transaction signing. Please use a compatible wallet.',
        );
      }

      const connection = getConnection();

      // Build the real Anchor instruction
      const instruction = await buildInstructionForOrder(order, publicKey);

      // Create a transaction with the instruction
      const transaction = new Transaction();
      transaction.add(instruction);

      // Fetch a recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign via the wallet adapter
      const signed = await signTransaction(transaction);

      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Confirm the transaction
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      setLastTxSignature(signature);
      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLastError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [connected, publicKey, signTransaction]);

  return { submitOrder, isSubmitting, lastError, lastTxSignature };
}
