'use client';

import { useState, useEffect } from 'react';
import type { PriceData } from '@meridian/shared/types';
import type { SupportedTicker } from '@meridian/shared/constants';
import { MOCK_PRICES } from '@/lib/mock-data';

export interface UsePythPriceResult {
  readonly priceData: PriceData | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

/**
 * Hook to fetch live price data for a ticker.
 * Stage A: returns mock data with simulated price movement.
 */
export function usePythPrice(ticker: SupportedTicker | null): UsePythPriceResult {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setPriceData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const mock = MOCK_PRICES[ticker];
    if (!mock) {
      setError(`No price data for ${ticker}`);
      setIsLoading(false);
      return;
    }

    // Initial load
    setPriceData({ ...mock, timestamp: Date.now() });
    setIsLoading(false);

    // Simulate price movement every 3 seconds
    const interval = setInterval(() => {
      const jitter = (Math.random() - 0.5) * 0.5;
      setPriceData((prev) =>
        prev
          ? {
              ...prev,
              price: parseFloat((prev.price + jitter).toFixed(2)),
              timestamp: Date.now(),
            }
          : null,
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [ticker]);

  return { priceData, isLoading, error };
}
