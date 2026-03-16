import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock demo mode ON first, then test live mode separately
vi.mock('../../src/lib/demo', () => ({
  IS_DEMO_MODE: true,
}));

import { usePythPrice } from '../../src/hooks/usePythPrice';

describe('usePythPrice (demo mode)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null price data when ticker is null', () => {
    const { result } = renderHook(() => usePythPrice(null));

    expect(result.current.priceData).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns mock price data for AAPL', () => {
    const { result } = renderHook(() => usePythPrice('AAPL'));

    expect(result.current.priceData).not.toBeNull();
    expect(result.current.priceData!.price).toBeCloseTo(228.5, 0);
    expect(result.current.priceData!.source).toBe('pyth');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns mock price data for NVDA', () => {
    const { result } = renderHook(() => usePythPrice('NVDA'));

    expect(result.current.priceData).not.toBeNull();
    expect(result.current.priceData!.price).toBeCloseTo(138.75, 0);
    expect(result.current.priceData!.feedId).toBe('pyth-nvda-feed');
  });

  it('returns mock price data for all supported tickers', () => {
    const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'] as const;

    for (const ticker of tickers) {
      const { result } = renderHook(() => usePythPrice(ticker));
      expect(result.current.priceData).not.toBeNull();
      expect(result.current.priceData!.price).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    }
  });

  it('updates price with jitter over time', () => {
    const { result } = renderHook(() => usePythPrice('AAPL'));

    const initialPrice = result.current.priceData!.price;
    const initialTimestamp = result.current.priceData!.timestamp;

    // Advance multiple intervals to increase chance of observing jitter
    act(() => {
      vi.advanceTimersByTime(9000); // 3 jitter intervals
    });

    const updatedPrice = result.current.priceData!.price;
    const updatedTimestamp = result.current.priceData!.timestamp;

    // Timestamp must have advanced
    expect(updatedTimestamp).toBeGreaterThan(initialTimestamp);

    // After 3 intervals, the price should have changed (jitter applies ±random offset)
    // We test that the price is within a reasonable jitter band (~±2% of base)
    const basePrice = 228.5; // AAPL mock base
    expect(updatedPrice).toBeGreaterThan(basePrice * 0.97);
    expect(updatedPrice).toBeLessThan(basePrice * 1.03);
  });

  it('has a confidence value', () => {
    const { result } = renderHook(() => usePythPrice('AAPL'));

    expect(result.current.priceData!.confidence).toBeGreaterThan(0);
  });

  it('has a feedId', () => {
    const { result } = renderHook(() => usePythPrice('AAPL'));

    expect(result.current.priceData!.feedId).toBe('pyth-aapl-feed');
  });

  it('has a recent timestamp', () => {
    const { result } = renderHook(() => usePythPrice('AAPL'));

    const now = Date.now();
    expect(result.current.priceData!.timestamp).toBeLessThanOrEqual(now + 1000);
    expect(result.current.priceData!.timestamp).toBeGreaterThan(now - 60000);
  });

  it('cleans up interval on unmount', () => {
    const { unmount } = renderHook(() => usePythPrice('AAPL'));

    // Should not throw
    unmount();

    // Advancing timers after unmount should not cause errors
    act(() => {
      vi.advanceTimersByTime(10000);
    });
  });
});
