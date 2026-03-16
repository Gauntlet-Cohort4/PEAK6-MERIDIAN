/**
 * Integration test: Morning Job Strike Calculation
 *
 * Covers ProjSpec requirement:
 *   Morning job creates correct strikes (+-3%, +-6%, +-9%, rounded to $10, deduplicated)
 *
 * Verifies end-to-end that the morning job produces the correct strike
 * prices for various ticker prices and passes them to createStrikeMarket.
 */

import { describe, it, expect, vi } from 'vitest';
import { runMorningJob, type MorningJobDeps } from '../../automation/src/jobs/morning-job.js';
import { calculateStrikes } from '../../automation/src/services/strike-calculator.js';
import { MERIDIAN_CONFIG, PYTH_FEED_IDS, type SupportedTicker } from '@meridian/shared/constants.js';
import type { CreateStrikeMarketParams } from '../../automation/src/services/meridian-client.js';
import type { MeridianClient } from '../../automation/src/services/meridian-client.js';
import {
  createMockPriceService,
  createMockTradingDayService,
  createMockAlertService,
  buildPriceData,
} from './helpers/mock-factories.js';

describe('Morning Job Strike Calculation', () => {
  /**
   * Helper: run morning job with a fixed price for all tickers and capture
   * all createStrikeMarket calls.
   */
  async function runWithFixedPrice(price: number): Promise<{
    createdMarkets: CreateStrikeMarketParams[];
    strikesPerTicker: Map<string, number[]>;
  }> {
    const createdMarkets: CreateStrikeMarketParams[] = [];

    const priceService = createMockPriceService({
      getHistoricalPrice: vi.fn().mockResolvedValue(
        buildPriceData({ price }),
      ),
    });

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockImplementation(async (params: CreateStrikeMarketParams) => {
        createdMarkets.push(params);
        return `sig-${createdMarkets.length}`;
      }),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('sig'),
      adminSettle: vi.fn().mockResolvedValue('sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const deps: MorningJobDeps = {
      priceService,
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService: createMockAlertService().service,
    };

    await runMorningJob(deps);

    // Group strikes by ticker
    const strikesPerTicker = new Map<string, number[]>();
    for (const market of createdMarkets) {
      const existing = strikesPerTicker.get(market.ticker) ?? [];
      existing.push(market.strikePrice);
      strikesPerTicker.set(market.ticker, existing);
    }

    return { createdMarkets, strikesPerTicker };
  }

  it('should create strikes at +-3%, +-6%, +-9% of close price rounded to $10', async () => {
    const closePrice = 500;
    const { strikesPerTicker } = await runWithFixedPrice(closePrice);

    // Each ticker should get the same strikes since all have the same price
    const expectedStrikes = calculateStrikes(closePrice);
    // $500: offsets are 3/6/9% => 485->490, 470, 455->460, 515->520, 530, 545->550
    // Center: 500
    expect(expectedStrikes).toEqual([460, 470, 490, 500, 520, 530, 550]);

    for (const [ticker, strikes] of strikesPerTicker) {
      expect(strikes.sort((a, b) => a - b)).toEqual(expectedStrikes);
    }
  });

  it('should round all strikes to nearest $10', async () => {
    const closePrice = 187.35; // Not a clean number
    const { createdMarkets } = await runWithFixedPrice(closePrice);

    for (const market of createdMarkets) {
      expect(market.strikePrice % 10).toBe(0);
    }
  });

  it('should deduplicate strikes when offsets produce the same rounded value', async () => {
    // At $200, 3% offset = $6 and 6% offset = $12
    // 200 * 0.97 = 194 -> rounds to 190
    // 200 * 0.94 = 188 -> rounds to 190 (DUPLICATE!)
    // These should be deduplicated
    const closePrice = 200;
    const strikes = calculateStrikes(closePrice);

    // Should be sorted and unique
    const unique = [...new Set(strikes)];
    expect(strikes.length).toBe(unique.length);

    // Verify expected deduplication: 194->190 and 188->190 collapse
    expect(strikes).toEqual([180, 190, 200, 210, 220]);
  });

  it('should create correct strikes for AAPL at ~$185', async () => {
    const price = 185.50;
    const strikes = calculateStrikes(price);

    // Center: round(185.50 / 10) * 10 = 190
    // +3%: 185.50 * 1.03 = 191.065 -> 190 (duplicate with center)
    // +6%: 185.50 * 1.06 = 196.63 -> 200
    // +9%: 185.50 * 1.09 = 202.195 -> 200 (duplicate)
    // -3%: 185.50 * 0.97 = 179.935 -> 180
    // -6%: 185.50 * 0.94 = 174.37 -> 170
    // -9%: 185.50 * 0.91 = 168.805 -> 170 (duplicate)
    expect(strikes).toEqual([170, 180, 190, 200]);
  });

  it('should create correct strikes for NVDA at ~$875', async () => {
    const price = 875.40;
    const strikes = calculateStrikes(price);

    // Center: round(875.40 / 10) * 10 = 880
    // +3%: 875.40 * 1.03 = 901.662 -> 900
    // +6%: 875.40 * 1.06 = 927.924 -> 930
    // +9%: 875.40 * 1.09 = 954.186 -> 950
    // -3%: 875.40 * 0.97 = 849.138 -> 850
    // -6%: 875.40 * 0.94 = 822.876 -> 820
    // -9%: 875.40 * 0.91 = 796.614 -> 800
    expect(strikes).toEqual([800, 820, 850, 880, 900, 930, 950]);
  });

  it('should create correct strikes for a low-price stock (~$12)', async () => {
    const price = 12;
    const strikes = calculateStrikes(price);

    // All offsets at this price will be small and round to 10 or 10
    // Center: 10
    // +3%: 12.36 -> 10, +6%: 12.72 -> 10, +9%: 13.08 -> 10
    // -3%: 11.64 -> 10, -6%: 11.28 -> 10, -9%: 10.92 -> 10
    // Everything rounds to 10 (deduplicated to just [10])
    expect(strikes.length).toBeGreaterThanOrEqual(1);
    expect(strikes.every(s => s > 0)).toBe(true);
    expect(strikes.every(s => s % 10 === 0)).toBe(true);
  });

  it('should process all 7 supported tickers', async () => {
    const { strikesPerTicker } = await runWithFixedPrice(300);

    expect(strikesPerTicker.size).toBe(7);
    for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
      expect(strikesPerTicker.has(ticker)).toBe(true);
    }
  });

  it('should pass correct ticker to createStrikeMarket', async () => {
    const { createdMarkets } = await runWithFixedPrice(500);

    const tickers = new Set(createdMarkets.map(m => m.ticker));

    for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
      expect(tickers.has(ticker)).toBe(true);
    }
  });

  it('should pass tradingDate to createStrikeMarket', async () => {
    const { createdMarkets } = await runWithFixedPrice(500);

    for (const market of createdMarkets) {
      expect(market.tradingDate).toBeGreaterThan(0);
      // Trading date should be a Unix timestamp (seconds since epoch)
      // Should be recent (within last hour of test execution)
      const nowSeconds = Math.floor(Date.now() / 1000);
      expect(market.tradingDate).toBeLessThanOrEqual(nowSeconds + 60);
      expect(market.tradingDate).toBeGreaterThan(nowSeconds - 3600);
    }
  });

  it('should use different prices per ticker when oracle returns different values', async () => {
    const tickerPrices: Record<string, number> = {
      AAPL: 185.50,
      MSFT: 420.25,
      GOOGL: 175.80,
      AMZN: 195.60,
      NVDA: 875.40,
      META: 505.20,
      TSLA: 248.90,
    };

    const createdMarkets: CreateStrikeMarketParams[] = [];

    const priceService = createMockPriceService({
      getHistoricalPrice: vi.fn().mockImplementation(async (feedId: string) => {
        const ticker = (Object.entries(PYTH_FEED_IDS) as Array<[SupportedTicker, string]>)
          .find(([, id]) => id === feedId)?.[0];
        const price = ticker ? tickerPrices[ticker] ?? 100 : 100;
        return buildPriceData({ price, feedId });
      }),
    });

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockImplementation(async (params: CreateStrikeMarketParams) => {
        createdMarkets.push(params);
        return `sig-${createdMarkets.length}`;
      }),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('sig'),
      adminSettle: vi.fn().mockResolvedValue('sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const deps: MorningJobDeps = {
      priceService,
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService: createMockAlertService().service,
    };

    const result = await runMorningJob(deps);
    expect(result.tickersProcessed).toBe(7);

    // Group by ticker and verify each has correct strikes for its price
    const byTicker = new Map<string, number[]>();
    for (const m of createdMarkets) {
      const existing = byTicker.get(m.ticker) ?? [];
      existing.push(m.strikePrice);
      byTicker.set(m.ticker, existing);
    }

    for (const [ticker, strikes] of byTicker) {
      const price = tickerPrices[ticker] ?? 100;
      const expected = calculateStrikes(price);
      expect(strikes.sort((a, b) => a - b)).toEqual([...expected]);
    }
  });

  it('should skip the job on non-trading days', async () => {
    const deps: MorningJobDeps = {
      priceService: createMockPriceService(),
      tradingDayService: createMockTradingDayService({
        isTradingDay: vi.fn().mockResolvedValue(false),
      }),
      meridianClient: {
        createStrikeMarket: vi.fn(),
        setPhoenixMarket: vi.fn(),
        settleMarket: vi.fn(),
        adminSettle: vi.fn(),
        getActiveMarkets: vi.fn().mockResolvedValue([]),
        buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
        buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
        sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
      },
      alertService: createMockAlertService().service,
    };

    const result = await runMorningJob(deps);

    expect(result.skipped).toBe(true);
    expect(result.strikesCreated).toBe(0);
    expect(result.tickersProcessed).toBe(0);
    expect(deps.meridianClient.createStrikeMarket).not.toHaveBeenCalled();
  });

  it('should validate STRIKE_OFFSETS_PERCENT config is [3, 6, 9]', () => {
    expect(MERIDIAN_CONFIG.STRIKE_OFFSETS_PERCENT).toEqual([3, 6, 9]);
  });

  it('should validate STRIKE_ROUNDING config is $10', () => {
    expect(MERIDIAN_CONFIG.STRIKE_ROUNDING).toBe(10);
  });
});
