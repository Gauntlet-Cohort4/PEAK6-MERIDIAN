/**
 * @module usePriceHistory
 * Fetches intraday price history for a stock ticker.
 * Uses Yahoo Finance chart API in live mode, synthetic data in demo mode.
 */

import { useEffect, useState } from 'react';
import { IS_DEMO_MODE } from '@/lib/demo';
import { MOCK_PRICES } from '@/lib/mock-data';
import type { SupportedTicker } from '@meridian/shared/constants';

/** A single price data point for charting. */
export interface PricePoint {
  readonly time: number;
  readonly value: number;
}

interface PriceHistoryResult {
  readonly prices: readonly PricePoint[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

/** Number of 5-minute intervals in a 6.5-hour trading day. */
const TRADING_DAY_INTERVALS = 78;

/** Volatility factor for synthetic random walk (fraction of price). */
const SYNTHETIC_VOLATILITY = 0.003;

/**
 * Generates synthetic intraday price data using a random walk.
 * Produces ~78 data points (one per 5 min for a 6.5hr trading day).
 */
function generateSyntheticData(basePrice: number): readonly PricePoint[] {
  const now = Date.now();
  const marketOpenMs = now - TRADING_DAY_INTERVALS * 5 * 60 * 1000;
  let currentPrice = basePrice * (1 - SYNTHETIC_VOLATILITY * 10);

  const points: PricePoint[] = [];
  for (let i = 0; i < TRADING_DAY_INTERVALS; i++) {
    const drift = (Math.random() - 0.48) * basePrice * SYNTHETIC_VOLATILITY;
    currentPrice = currentPrice + drift;
    // Clamp to avoid unrealistic deviations
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

/**
 * Parses Yahoo Finance chart API response into PricePoint array.
 */
function parseYahooResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): readonly PricePoint[] | null {
  try {
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] =
      result.indicators?.quote?.[0]?.close ?? [];

    if (timestamps.length === 0 || closes.length === 0) return null;

    const points: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const closeValue = closes[i];
      if (closeValue != null && !isNaN(closeValue)) {
        points.push({
          time: timestamps[i] * 1000, // Yahoo returns seconds
          value: parseFloat(closeValue.toFixed(2)),
        });
      }
    }

    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
}

// Module-level cache (shared across all component instances)
const priceCache = new Map<string, readonly PricePoint[]>();

/**
 * Hook that fetches intraday price history for a stock ticker.
 *
 * - In demo mode: generates synthetic data based on mock prices.
 * - In live mode: fetches from Yahoo Finance, falls back to synthetic
 *   data if the request fails (e.g., CORS blocking).
 * - Caches results to avoid re-fetching on every render.
 */
export function usePriceHistory(ticker: SupportedTicker): PriceHistoryResult {
  const [prices, setPrices] = useState<readonly PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData(): Promise<void> {
      // Return cached data if available
      const cached = priceCache.get(ticker);
      if (cached) {
        setPrices(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Demo mode: use synthetic data from mock prices
      if (IS_DEMO_MODE) {
        const mockPrice = MOCK_PRICES[ticker]?.price ?? 100;
        const syntheticPrices = generateSyntheticData(mockPrice);
        priceCache.set(ticker, syntheticPrices);
        if (!cancelled) {
          setPrices(syntheticPrices);
          setIsLoading(false);
        }
        return;
      }

      // Live mode: try Yahoo Finance API
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=5m&range=1d`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Yahoo Finance returned ${response.status}`);
        }

        const data = await response.json();
        const parsed = parseYahooResponse(data);

        if (parsed && !cancelled) {
          priceCache.set(ticker, parsed);
          setPrices(parsed);
          setIsLoading(false);
          return;
        }

        throw new Error('No valid price data in response');
      } catch (fetchError) {
        // CORS or network failure: fall back to synthetic data
        // centered around the mock price as a best-effort fallback
        const fallbackPrice = MOCK_PRICES[ticker]?.price ?? 100;
        const fallbackPrices = generateSyntheticData(fallbackPrice);
        priceCache.set(ticker, fallbackPrices);

        if (!cancelled) {
          setPrices(fallbackPrices);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Failed to fetch price history',
          );
          setIsLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return { prices, isLoading, error };
}

export default usePriceHistory;
