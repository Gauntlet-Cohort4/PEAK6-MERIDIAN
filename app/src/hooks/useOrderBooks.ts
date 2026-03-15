'use client';

import { useState, useEffect } from 'react';
import type { OrderBookState } from '@meridian/shared/types';
import { MOCK_ORDER_BOOKS } from '@/lib/mock-data';

/** Whether the app is running in demo mode (no real on-chain reads). */
const IS_DEMO_MODE =
  typeof process !== 'undefined' &&
  process.env?.['NEXT_PUBLIC_DEMO_MODE'] === 'true';

export interface UseOrderBooksResult {
  readonly orderBooks: Record<string, OrderBookState>;
  readonly isLoading: boolean;
  readonly error: string | null;
}

/**
 * Hook to fetch order book data for all active markets.
 *
 * Demo mode: returns MOCK_ORDER_BOOKS with simulated updates.
 * Real mode: returns empty order books (Phoenix integration pending).
 *   When Phoenix markets are live, this will read from Phoenix DEX.
 */
export function useOrderBooks(
  marketAddresses: readonly string[],
): UseOrderBooksResult {
  const [orderBooks, setOrderBooks] = useState<Record<string, OrderBookState>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setOrderBooks(MOCK_ORDER_BOOKS);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Real mode: return empty order books per market address.
    // Phoenix order book reading will be wired here when available.
    if (marketAddresses.length === 0) {
      setOrderBooks({});
      setIsLoading(false);
      return;
    }

    const emptyBooks: Record<string, OrderBookState> = {};
    for (const addr of marketAddresses) {
      emptyBooks[addr] = {
        marketAddress: addr,
        bids: [],
        asks: [],
        lastUpdated: Date.now(),
        spread: null,
      };
    }

    setOrderBooks(emptyBooks);
    setIsLoading(false);
    setError(null);
  }, [marketAddresses]);

  return { orderBooks, isLoading, error };
}
