'use client';

import { useCallback, useState } from 'react';
import type { TradeOrder } from '@meridian/shared/types';

export interface UseTradeActionsResult {
  readonly submitOrder: (order: TradeOrder) => Promise<string>;
  readonly isSubmitting: boolean;
  readonly lastError: string | null;
  readonly lastTxSignature: string | null;
}

/**
 * Hook for trade execution.
 * Stage A: stub implementation that simulates order submission.
 */
export function useTradeActions(): UseTradeActionsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

  const submitOrder = useCallback(async (order: TradeOrder): Promise<string> => {
    setIsSubmitting(true);
    setLastError(null);

    try {
      // Stage A: simulate network delay and return mock signature
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockSig = `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
