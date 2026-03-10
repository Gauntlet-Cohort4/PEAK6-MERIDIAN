'use client';

import { useState, useEffect } from 'react';
import type { OrderBookState } from '@meridian/shared/types';
import { MOCK_ORDER_BOOKS } from '@/lib/mock-data';

export interface UsePhoenixBookResult {
  readonly orderBook: OrderBookState | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

/**
 * Hook to fetch order book data for a market.
 * Stage A: returns mock data.
 */
export function usePhoenixBook(
  marketAddress: string | null,
): UsePhoenixBookResult {
  const [orderBook, setOrderBook] = useState<OrderBookState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketAddress) {
      setOrderBook(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Simulate async fetch with mock data
    const timer = setTimeout(() => {
      const mock = MOCK_ORDER_BOOKS[marketAddress];
      if (mock) {
        setOrderBook(mock);
      } else {
        setError('Order book not found');
      }
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [marketAddress]);

  return { orderBook, isLoading, error };
}
