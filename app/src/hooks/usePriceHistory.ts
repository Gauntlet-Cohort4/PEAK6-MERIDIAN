/**
 * @module usePriceHistory
 * Provides intraday price history for a stock ticker.
 * Reads from the shared price-history-buffer that is populated by usePythPrice.
 *
 * In demo mode: generates synthetic data based on mock prices.
 * In live mode: reads accumulated Pyth prices from the buffer and
 * subscribes to updates so the chart refreshes as new prices arrive.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { IS_DEMO_MODE } from '@/lib/demo';
import { MOCK_PRICES } from '@/lib/mock-data';
import {
  type PricePoint,
  getHistory,
  subscribe,
} from '@/lib/price-history-buffer';
import type { SupportedTicker } from '@meridian/shared/constants';

// Re-export PricePoint so existing consumers keep working
export type { PricePoint } from '@/lib/price-history-buffer';

interface PriceHistoryResult {
  readonly prices: readonly PricePoint[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

/** Number of 5-minute intervals in a 6.5-hour trading day. */
const TRADING_DAY_INTERVALS = 78;

/** Volatility factor for demo synthetic random walk (fraction of price). */
const SYNTHETIC_VOLATILITY = 0.003;

/**
 * Generates synthetic intraday price data using a random walk.
 * Used only in demo mode.
 */
function generateSyntheticData(basePrice: number): readonly PricePoint[] {
  const now = Date.now();
  const marketOpenMs = now - TRADING_DAY_INTERVALS * 5 * 60 * 1000;
  let currentPrice = basePrice * (1 - SYNTHETIC_VOLATILITY * 10);

  const points: PricePoint[] = [];
  for (let i = 0; i < TRADING_DAY_INTERVALS; i++) {
    const drift = (Math.random() - 0.48) * basePrice * SYNTHETIC_VOLATILITY;
    currentPrice = currentPrice + drift;
    const maxDeviation = basePrice * 0.05;
    currentPrice = Math.max(
      basePrice - maxDeviation,
      Math.min(basePrice + maxDeviation, currentPrice),
    );

    points.push({
      time: marketOpenMs + i * 5 * 60 * 1000,
      value: parseFloat(currentPrice.toFixed(2)),
    });
  }

  return points;
}

// Module-level cache for demo mode synthetic data (stable across re-renders)
const demoCache = new Map<string, readonly PricePoint[]>();

/**
 * Hook that provides intraday price history for a stock ticker.
 *
 * - In demo mode: generates and caches synthetic data from mock prices.
 * - In live mode: reads from the shared price-history-buffer that
 *   usePythPrice populates on each poll. Subscribes to updates so the
 *   chart re-renders as new prices arrive.
 */
export function usePriceHistory(ticker: SupportedTicker): PriceHistoryResult {
  // --- Demo mode: static synthetic data ---
  if (IS_DEMO_MODE) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDemoPriceHistory(ticker);
  }

  // --- Live mode: read from shared buffer ---
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useLivePriceHistory(ticker);
}

/** Demo mode hook — generates synthetic data once and caches it. */
function useDemoPriceHistory(ticker: SupportedTicker): PriceHistoryResult {
  const [prices] = useState<readonly PricePoint[]>(() => {
    const cached = demoCache.get(ticker);
    if (cached) return cached;

    const mockPrice = MOCK_PRICES[ticker]?.price ?? 100;
    const data = generateSyntheticData(mockPrice);
    demoCache.set(ticker, data);
    return data;
  });

  return { prices, isLoading: false, error: null };
}

/** Live mode hook — subscribes to the price-history-buffer. */
function useLivePriceHistory(ticker: SupportedTicker): PriceHistoryResult {
  const subscribeFn = useCallback(
    (onStoreChange: () => void) => subscribe(ticker, onStoreChange),
    [ticker],
  );

  const getSnapshot = useCallback(() => getHistory(ticker), [ticker]);

  const prices = useSyncExternalStore(subscribeFn, getSnapshot, getSnapshot);

  // If the buffer is empty, usePythPrice hasn't fetched yet — show loading
  const isLoading = prices.length === 0;

  return { prices, isLoading, error: null };
}

export default usePriceHistory;
