/**
 * Tests for the morning job orchestration.
 */

import { describe, it, expect, vi } from 'vitest';
import { runMorningJob, type MorningJobDeps } from '../src/jobs/morning-job.js';
import type { PriceServiceAdapter, TradingDayAdapter } from '@meridian/shared/adapters/types.js';
import type { PriceData } from '@meridian/shared/types.js';
import type { MeridianClient } from '../src/services/meridian-client.js';
import type { AlertService } from '../src/services/alert-service.js';

function createMockPriceData(price: number, feedId: string): PriceData {
  return Object.freeze({
    price,
    confidence: price * 0.001,
    timestamp: 1700000000,
    feedId,
    source: 'test-mock',
  });
}

function createMockDeps(overrides?: Partial<MorningJobDeps>): MorningJobDeps {
  const priceService: PriceServiceAdapter = {
    getLatestPrice: vi.fn().mockResolvedValue(createMockPriceData(185.5, 'test')),
    getHistoricalPrice: vi.fn().mockResolvedValue(createMockPriceData(185.5, 'test')),
    health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
  };

  const tradingDayService: TradingDayAdapter = {
    isTradingDay: vi.fn().mockResolvedValue(true),
    getNextTradingDay: vi.fn().mockResolvedValue(new Date()),
    health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
  };

  const meridianClient: MeridianClient = {
    createStrikeMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
    setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
    settleMarket: vi.fn().mockResolvedValue('mock-tx-sig'),
    adminSettle: vi.fn().mockResolvedValue('mock-tx-sig'),
    getActiveMarkets: vi.fn().mockResolvedValue([]),
    buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
    buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
    sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
  };

  const alertService: AlertService = {
    sendAlert: vi.fn().mockResolvedValue(undefined),
  };

  return {
    priceService: overrides?.priceService ?? priceService,
    tradingDayService: overrides?.tradingDayService ?? tradingDayService,
    meridianClient: overrides?.meridianClient ?? meridianClient,
    alertService: overrides?.alertService ?? alertService,
  };
}

describe('runMorningJob', () => {
  it('should skip when not a trading day', async () => {
    const deps = createMockDeps({
      tradingDayService: {
        isTradingDay: vi.fn().mockResolvedValue(false),
        getNextTradingDay: vi.fn().mockResolvedValue(new Date()),
        health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
      },
    });

    const result = await runMorningJob(deps);

    expect(result.skipped).toBe(true);
    expect(result.tickersProcessed).toBe(0);
    expect(result.strikesCreated).toBe(0);
  });

  it('should process all tickers on a trading day', async () => {
    const deps = createMockDeps();
    const result = await runMorningJob(deps);

    expect(result.skipped).toBe(false);
    expect(result.tickersProcessed).toBe(7); // 7 supported tickers
    // With $10 rounding, 185.5 yields 4 unique strikes per ticker
    expect(result.strikesCreated).toBe(28); // 7 tickers * 4 strikes each
    expect(result.failures.length).toBe(0);
  });

  it('should record failures without stopping other tickers', async () => {
    // With retry (3 attempts), we need to reject 3 times to exhaust retries
    // for the first ticker. callCount 1-3 reject, 4+ resolve.
    let callCount = 0;
    const priceService: PriceServiceAdapter = {
      getLatestPrice: vi.fn().mockResolvedValue(createMockPriceData(100, 'test')),
      getHistoricalPrice: vi.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount <= 3) {
          return Promise.reject(new Error('Oracle unavailable'));
        }
        return Promise.resolve(createMockPriceData(100, 'test'));
      }),
      health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    };

    const deps = createMockDeps({ priceService });
    const result = await runMorningJob(deps);

    expect(result.failures.length).toBe(1);
    expect(result.tickersProcessed).toBe(6); // 7 - 1 failed
    expect(result.failures[0]).toContain('Oracle unavailable');
  });

  it('should call isTradingDay with the provided date', async () => {
    const isTradingDay = vi.fn().mockResolvedValue(false);
    const deps = createMockDeps({
      tradingDayService: {
        isTradingDay,
        getNextTradingDay: vi.fn().mockResolvedValue(new Date()),
        health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
      },
    });

    const testDate = new Date('2026-03-10T12:00:00Z');
    await runMorningJob(deps, testDate);

    expect(isTradingDay).toHaveBeenCalledWith(testDate);
  });

  it('should return duration in milliseconds', async () => {
    const deps = createMockDeps();
    const result = await runMorningJob(deps);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should return frozen summary', async () => {
    const deps = createMockDeps();
    const result = await runMorningJob(deps);

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should fetch historical price for each ticker', async () => {
    const getHistoricalPrice = vi.fn().mockResolvedValue(createMockPriceData(200, 'test'));
    const deps = createMockDeps({
      priceService: {
        getLatestPrice: vi.fn().mockResolvedValue(createMockPriceData(200, 'test')),
        getHistoricalPrice,
        health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
      },
    });

    await runMorningJob(deps);

    expect(getHistoricalPrice).toHaveBeenCalledTimes(7);
  });
});
