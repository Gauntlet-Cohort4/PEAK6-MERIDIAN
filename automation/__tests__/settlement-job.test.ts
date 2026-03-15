/**
 * Tests for the settlement job orchestration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runSettlementJob,
  type SettlementJobDeps,
  type ActiveMarket,
} from '../src/jobs/settlement-job.js';
import type { PriceServiceAdapter, TradingDayAdapter } from '@meridian/shared/adapters/types.js';
import type { PriceData } from '@meridian/shared/types.js';
import type { MeridianClient } from '../src/services/meridian-client.js';

function createMockPriceData(price: number): PriceData {
  return Object.freeze({
    price,
    confidence: price * 0.001,
    timestamp: Math.floor(Date.now() / 1000),
    feedId: 'test-feed',
    source: 'test-mock',
  });
}

function createMockDeps(overrides?: Partial<SettlementJobDeps>): SettlementJobDeps {
  const priceService: PriceServiceAdapter = {
    getLatestPrice: vi.fn().mockResolvedValue(createMockPriceData(185.5)),
    getHistoricalPrice: vi.fn().mockResolvedValue(createMockPriceData(185.5)),
    health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
  };

  const tradingDayService: TradingDayAdapter = {
    isTradingDay: vi.fn().mockResolvedValue(true),
    getNextTradingDay: vi.fn().mockResolvedValue(new Date()),
    health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
  };

  const meridianClient: MeridianClient = {
    createStrikeMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
    settleMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
    adminSettle: vi.fn().mockResolvedValue('mock-tx-sig'),
    getActiveMarkets: vi.fn().mockResolvedValue([]),
  };

  return {
    priceService: overrides?.priceService ?? priceService,
    tradingDayService: overrides?.tradingDayService ?? tradingDayService,
    meridianClient: overrides?.meridianClient ?? meridianClient,
  };
}

const mockMarkets: readonly ActiveMarket[] = [
  { ticker: 'AAPL', strikePrice: 190, marketAddress: 'market-aapl-190', pythPriceAccount: 'pyth-aapl' },
  { ticker: 'MSFT', strikePrice: 420, marketAddress: 'market-msft-420', pythPriceAccount: 'pyth-msft' },
  { ticker: 'NVDA', strikePrice: 880, marketAddress: 'market-nvda-880', pythPriceAccount: 'pyth-nvda' },
];

describe('runSettlementJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should skip when not a trading day', async () => {
    const deps = createMockDeps({
      tradingDayService: {
        isTradingDay: vi.fn().mockResolvedValue(false),
        getNextTradingDay: vi.fn().mockResolvedValue(new Date()),
        health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
      },
    });

    const result = await runSettlementJob(deps, mockMarkets);

    expect(result.skipped).toBe(true);
    expect(result.marketsSettled).toBe(0);
  });

  it('should settle all provided markets', async () => {
    const deps = createMockDeps();
    const result = await runSettlementJob(deps, mockMarkets);

    expect(result.skipped).toBe(false);
    expect(result.marketsSettled).toBe(3);
    expect(result.failures.length).toBe(0);
  });

  it('should schedule admin settle when oracle fails after retries', async () => {
    const priceService: PriceServiceAdapter = {
      getLatestPrice: vi.fn().mockRejectedValue(new Error('Oracle unavailable')),
      getHistoricalPrice: vi.fn().mockResolvedValue(createMockPriceData(100)),
      health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    };

    const deps = createMockDeps({ priceService });
    // Run the job and advance timers concurrently
    const resultPromise = runSettlementJob(deps, mockMarkets);

    // Advance timers enough for all retries (3 markets * 30 attempts * 30s)
    for (let i = 0; i < 100; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
    }

    const result = await resultPromise;

    expect(result.adminSettleScheduled).toBe(3);
    expect(result.marketsSettled).toBe(0);
  });

  it('should handle empty active markets list', async () => {
    const deps = createMockDeps();
    const result = await runSettlementJob(deps, []);

    expect(result.marketsSettled).toBe(0);
    expect(result.failures.length).toBe(0);
    expect(result.skipped).toBe(false);
  });

  it('should return duration in milliseconds', async () => {
    const deps = createMockDeps();
    const result = await runSettlementJob(deps, mockMarkets);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should return frozen summary', async () => {
    const deps = createMockDeps();
    const result = await runSettlementJob(deps, mockMarkets);

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should call isTradingDay with the provided date', async () => {
    const isTradingDay = vi.fn().mockResolvedValue(true);
    const deps = createMockDeps({
      tradingDayService: {
        isTradingDay,
        getNextTradingDay: vi.fn().mockResolvedValue(new Date()),
        health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
      },
    });

    const testDate = new Date('2026-03-10T12:00:00Z');
    await runSettlementJob(deps, mockMarkets, testDate);

    expect(isTradingDay).toHaveBeenCalledWith(testDate);
  });

  it('should record failures in summary', async () => {
    // Second market's oracle always fails, others succeed
    let callCount = 0;
    const priceService: PriceServiceAdapter = {
      getLatestPrice: vi.fn().mockImplementation(() => {
        callCount += 1;
        // First market succeeds (call 1), second market fails all 30 attempts,
        // third market succeeds. Since retries happen, we need to fail for
        // calls 2 through 31 (30 attempts for the second market).
        if (callCount >= 2 && callCount <= 31) {
          return Promise.reject(new Error('Feed unavailable'));
        }
        return Promise.resolve(createMockPriceData(200));
      }),
      getHistoricalPrice: vi.fn().mockResolvedValue(createMockPriceData(200)),
      health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    };

    const deps = createMockDeps({ priceService });
    const resultPromise = runSettlementJob(deps, mockMarkets);

    // Advance timers for the retries
    for (let i = 0; i < 35; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
    }

    const result = await resultPromise;

    expect(result.failures.length).toBe(1);
    expect(result.failures[0]).toContain('Feed unavailable');
  });
});

describe('getActiveMarkets via client', () => {
  it('should call meridianClient.getActiveMarkets when no markets are injected', async () => {
    const getActiveMarkets = vi.fn().mockResolvedValue([]);
    const deps = createMockDeps({
      meridianClient: {
        createStrikeMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
        settleMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
        adminSettle: vi.fn().mockResolvedValue('mock-tx-sig'),
        getActiveMarkets,
      },
    });

    const result = await runSettlementJob(deps);

    expect(getActiveMarkets).toHaveBeenCalledOnce();
    expect(result.marketsSettled).toBe(0);
    expect(result.skipped).toBe(false);
  });

  it('should not call meridianClient.getActiveMarkets when markets are injected', async () => {
    const getActiveMarkets = vi.fn().mockResolvedValue([]);
    const deps = createMockDeps({
      meridianClient: {
        createStrikeMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
        settleMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
        adminSettle: vi.fn().mockResolvedValue('mock-tx-sig'),
        getActiveMarkets,
      },
    });

    await runSettlementJob(deps, mockMarkets);

    expect(getActiveMarkets).not.toHaveBeenCalled();
  });
});
