'use client';

import { useState, useEffect, useRef } from 'react';
import type { PriceData } from '@meridian/shared/types';
import type { SupportedTicker } from '@meridian/shared/constants';
import { PYTH_FEED_IDS } from '@meridian/shared/constants';
import { MOCK_PRICES } from '@/lib/mock-data';

/** Whether the app is running in demo mode. */
const IS_DEMO_MODE =
  typeof process !== 'undefined' &&
  process.env?.['NEXT_PUBLIC_DEMO_MODE'] === 'true';

/** Pyth Hermes API base URL. */
const HERMES_BASE_URL = 'https://hermes.pyth.network';

/** Polling interval for live price updates (milliseconds). */
const POLL_INTERVAL_MS = 10_000;

export interface UsePythPriceResult {
  readonly priceData: PriceData | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

/**
 * Parse Pyth Hermes price feed response into our PriceData shape.
 * Hermes returns price as string with an exponent, e.g. price="22850" expo=-2 => $228.50
 */
function parseHermesPrice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feed: any,
  feedId: string,
): PriceData {
  const priceObj = feed.price ?? feed.ema_price;
  const rawPrice = Number(priceObj.price);
  const expo = Number(priceObj.expo);
  const price = rawPrice * Math.pow(10, expo);

  const rawConf = Number(priceObj.conf);
  const confidence = rawConf * Math.pow(10, expo);

  const timestamp = Number(priceObj.publish_time) * 1000;

  return {
    price: parseFloat(price.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(4)),
    timestamp,
    feedId,
    source: 'pyth',
  };
}

/**
 * Fetch a single price feed from Pyth Hermes API.
 */
async function fetchPythPrice(feedId: string): Promise<PriceData> {
  const url = `${HERMES_BASE_URL}/api/latest_price_feeds?ids[]=${feedId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No price feed data returned from Hermes');
  }

  return parseHermesPrice(data[0], feedId);
}

/**
 * Hook to fetch live price data for a ticker from Pyth Hermes.
 *
 * When DEMO_MODE=true, returns mock data with simulated price movement.
 * When DEMO_MODE=false, polls Hermes every 10 seconds for live prices.
 */
export function usePythPrice(ticker: SupportedTicker | null): UsePythPriceResult {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ticker) {
      setPriceData(null);
      setIsLoading(false);
      return;
    }

    // Demo mode — use mock data with simulated jitter
    if (IS_DEMO_MODE) {
      setIsLoading(true);
      setError(null);

      const mock = MOCK_PRICES[ticker];
      if (!mock) {
        setError(`No price data for ${ticker}`);
        setIsLoading(false);
        return;
      }

      setPriceData({ ...mock, timestamp: Date.now() });
      setIsLoading(false);

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
    }

    // Live mode — fetch from Pyth Hermes
    const feedId = PYTH_FEED_IDS[ticker];
    if (!feedId) {
      setError(`No Pyth feed ID configured for ${ticker}`);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPrice() {
      try {
        const data = await fetchPythPrice(feedId);
        if (!cancelled) {
          setPriceData(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to fetch price';
          console.error(`usePythPrice(${ticker}): fetch failed`, err);
          setError(message);
          // Keep last known price if we have one
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    // Initial fetch
    setIsLoading(true);
    setError(null);
    fetchPrice();

    // Poll every 10 seconds
    intervalRef.current = setInterval(fetchPrice, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [ticker]);

  return { priceData, isLoading, error };
}
