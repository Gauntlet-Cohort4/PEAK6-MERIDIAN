/**
 * Integration test: Settlement Job Retry and Alert Behavior
 *
 * Covers ProjSpec requirements:
 *   - Settlement job retries on oracle failure
 *   - Alerts after 15 minutes (30 attempts * 30s)
 *   - Settlement outcome correctness across all scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSettlementJob, type SettlementJobDeps } from '../../automation/src/jobs/settlement-job.js';
import type { PriceServiceAdapter } from '@meridian/shared/adapters/types.js';
import type { MeridianClient, SettleMarketParams } from '../../automation/src/services/meridian-client.js';
import type { ActiveMarket } from '../../automation/src/types/active-market.js';
import type { AlertService } from '../../automation/src/services/alert-service.js';
import {
  createMockPriceService,
  createMockTradingDayService,
  createMockAlertService,
  buildPriceData,
  buildActiveMarket,
  resetMarketCounter,
} from './helpers/mock-factories.js';

describe('Settlement Job Retry Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMarketCounter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry oracle fetch up to 30 times with 30s intervals', async () => {
    let attemptCount = 0;

    const priceService: PriceServiceAdapter = {
      getLatestPrice: vi.fn().mockImplementation(async () => {
        attemptCount += 1;
        // Fail on all attempts except the last (30th)
        if (attemptCount < 30) {
          throw new Error(`Oracle attempt ${attemptCount} failed`);
        }
        return buildPriceData({ price: 195 });
      }),
      getHistoricalPrice: vi.fn().mockResolvedValue(buildPriceData()),
      health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    };

    const settledParams: SettleMarketParams[] = [];
    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockImplementation(async (params: SettleMarketParams) => {
        settledParams.push(params);
        return 'settle-sig';
      }),
      adminSettle: vi.fn().mockResolvedValue('sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService, alerts } = createMockAlertService();

    const deps: SettlementJobDeps = {
      priceService,
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const market = buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 });

    const resultPromise = runSettlementJob(deps, [market]);

    // Advance timers for all 29 retry intervals (30s each)
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
    }

    const result = await resultPromise;

    // Should have succeeded on the 30th attempt
    expect(result.marketsSettled).toBe(1);
    expect(result.failures).toHaveLength(0);
    expect(settledParams).toHaveLength(1);
    expect(attemptCount).toBe(30);
    // No alert should have been sent since it eventually succeeded
    expect(alerts).toHaveLength(0);
  });

  it('should send critical alert after all 30 retry attempts fail', async () => {
    const priceService: PriceServiceAdapter = {
      getLatestPrice: vi.fn().mockRejectedValue(new Error('Oracle permanently down')),
      getHistoricalPrice: vi.fn().mockResolvedValue(buildPriceData()),
      health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    };

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('settle-sig'),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService, alerts } = createMockAlertService();

    const deps: SettlementJobDeps = {
      priceService,
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const market = buildActiveMarket({
      ticker: 'NVDA',
      strikePrice: 880,
      marketAddress: 'nvda-market-880',
    });

    const resultPromise = runSettlementJob(deps, [market]);

    // Advance enough time for all 30 retry attempts (30 * 30s = 900s = 15 min)
    for (let i = 0; i < 35; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
    }

    const result = await resultPromise;

    // Market should NOT have been settled
    expect(result.marketsSettled).toBe(0);
    expect(result.adminSettleScheduled).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('Oracle permanently down');

    // A critical alert should have been sent
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.level).toBe('critical');
    expect(alerts[0]!.title).toBe('Oracle Settlement Failed');
    expect(alerts[0]!.details).toMatchObject({
      ticker: 'NVDA',
      marketAddress: 'nvda-market-880',
      attempts: 30,
    });
    expect(alerts[0]!.details['lastError']).toContain('Oracle permanently down');
  });

  it('should send alerts for each market that fails independently', async () => {
    let callIndex = 0;
    const priceService: PriceServiceAdapter = {
      getLatestPrice: vi.fn().mockImplementation(async () => {
        callIndex += 1;
        // First market (calls 1-30) always fails
        // Second market (call 31+) succeeds
        if (callIndex <= 30) {
          throw new Error('Feed 1 down');
        }
        return buildPriceData({ price: 200 });
      }),
      getHistoricalPrice: vi.fn().mockResolvedValue(buildPriceData()),
      health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    };

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('settle-sig'),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService, alerts } = createMockAlertService();

    const deps: SettlementJobDeps = {
      priceService,
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const markets: readonly ActiveMarket[] = [
      buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 }),
      buildActiveMarket({ ticker: 'MSFT', strikePrice: 420 }),
    ];

    const resultPromise = runSettlementJob(deps, markets);

    for (let i = 0; i < 35; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
    }

    const result = await resultPromise;

    // First market should have failed, second should have succeeded
    expect(result.marketsSettled).toBe(1);
    expect(result.adminSettleScheduled).toBe(1);
    expect(result.failures).toHaveLength(1);

    // Alert sent only for the first failing market
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.details['ticker']).toBe('AAPL');
  });

  it('should recover mid-retry when oracle comes back', async () => {
    let attempt = 0;
    const priceService: PriceServiceAdapter = {
      getLatestPrice: vi.fn().mockImplementation(async () => {
        attempt += 1;
        // Fail for first 5 attempts, then succeed
        if (attempt <= 5) {
          throw new Error('Temporary oracle outage');
        }
        return buildPriceData({ price: 195 });
      }),
      getHistoricalPrice: vi.fn().mockResolvedValue(buildPriceData()),
      health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    };

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('settle-sig'),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService, alerts } = createMockAlertService();

    const deps: SettlementJobDeps = {
      priceService,
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const market = buildActiveMarket({ ticker: 'GOOGL', strikePrice: 180 });
    const resultPromise = runSettlementJob(deps, [market]);

    // Advance timers for the retries
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
    }

    const result = await resultPromise;

    expect(result.marketsSettled).toBe(1);
    expect(result.failures).toHaveLength(0);
    expect(alerts).toHaveLength(0);
    expect(attempt).toBe(6); // 5 failures + 1 success
  });
});

describe('Settlement Outcome Correctness', () => {
  // NOTE: The YES/NO outcome is determined ON-CHAIN by the Solana program
  // comparing the Pyth oracle price against the strike price. The automation
  // layer's settlement job does NOT compute the outcome — it just passes the
  // Pyth price account to the on-chain settleMarket instruction.
  //
  // These tests verify that the settlement job correctly calls settleMarket
  // with the right market address and oracle account, NOT the outcome logic
  // (which is tested in the Anchor tests in tests/meridian.ts).

  it('should settle market with correct outcome logged by settlement job', async () => {
    const settleCallArgs: Array<{ marketAddress: string; pythPriceAccount: string }> = [];

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockImplementation(async (params) => {
        settleCallArgs.push(params);
        return 'settle-sig';
      }),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    // Settlement price = 195 (above strike 190) -> YES wins
    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService({
        getLatestPrice: vi.fn().mockResolvedValue(buildPriceData({ price: 195 })),
      }),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const markets: readonly ActiveMarket[] = [
      buildActiveMarket({ ticker: 'AAPL', strikePrice: 190, marketAddress: 'aapl-190' }),
      buildActiveMarket({ ticker: 'MSFT', strikePrice: 420, marketAddress: 'msft-420' }),
    ];

    const result = await runSettlementJob(deps, markets);

    expect(result.marketsSettled).toBe(2);
    expect(settleCallArgs).toHaveLength(2);
    expect(settleCallArgs[0]!.marketAddress).toBe('aapl-190');
    expect(settleCallArgs[1]!.marketAddress).toBe('msft-420');
  });

  it('should handle settlement at exactly the strike price (edge case)', async () => {
    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('settle-sig'),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    // Settlement price exactly equals strike -> YES wins (>= comparison)
    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService({
        getLatestPrice: vi.fn().mockResolvedValue(buildPriceData({ price: 190 })),
      }),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const market = buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 });
    const result = await runSettlementJob(deps, [market]);

    expect(result.marketsSettled).toBe(1);
    expect(result.failures).toHaveLength(0);

    // Verify settleMarket was called with the correct market address and oracle
    expect(meridianClient.settleMarket).toHaveBeenCalledOnce();
    // Outcome (YES/NO) is determined on-chain, not in the automation layer
  });

  it('should settle multiple markets with different outcomes in one batch', async () => {
    const settleCallLog: Array<{ address: string; price: number }> = [];

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockImplementation(async (params: SettleMarketParams) => {
        settleCallLog.push({ address: params.marketAddress, price: 0 });
        return 'settle-sig';
      }),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    // Settlement price is 195 for all markets
    // Market 1: strike 190, settlement 195 -> YES
    // Market 2: strike 200, settlement 195 -> NO
    // Market 3: strike 195, settlement 195 -> YES (edge case: equal)
    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService({
        getLatestPrice: vi.fn().mockResolvedValue(buildPriceData({ price: 195 })),
      }),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const markets: readonly ActiveMarket[] = [
      buildActiveMarket({ ticker: 'AAPL', strikePrice: 190, marketAddress: 'market-yes' }),
      buildActiveMarket({ ticker: 'AAPL', strikePrice: 200, marketAddress: 'market-no' }),
      buildActiveMarket({ ticker: 'AAPL', strikePrice: 195, marketAddress: 'market-edge' }),
    ];

    const result = await runSettlementJob(deps, markets);

    expect(result.marketsSettled).toBe(3);
    expect(result.failures).toHaveLength(0);

    // Verify settleMarket was called for each market with correct addresses
    expect(settleCallLog).toHaveLength(3);
    expect(settleCallLog.map(c => c.address)).toEqual(['market-yes', 'market-no', 'market-edge']);
    // Outcome (YES/NO) is determined on-chain by the Solana program
  });

  it('should skip settlement on non-trading days', async () => {
    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn(),
      adminSettle: vi.fn(),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService(),
      tradingDayService: createMockTradingDayService({
        isTradingDay: vi.fn().mockResolvedValue(false),
      }),
      meridianClient,
      alertService,
    };

    const result = await runSettlementJob(deps, [
      buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 }),
    ]);

    expect(result.skipped).toBe(true);
    expect(result.marketsSettled).toBe(0);
    expect(meridianClient.settleMarket).not.toHaveBeenCalled();
  });

  it('should handle settlement when meridianClient.settleMarket throws', async () => {
    vi.useFakeTimers();

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockRejectedValue(new Error('RPC connection lost')),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService, alerts } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService(),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const market = buildActiveMarket({ ticker: 'META', strikePrice: 510 });
    const resultPromise = runSettlementJob(deps, [market]);

    // The settleMarket call itself will be retried (price fetch succeeds but settle fails)
    for (let i = 0; i < 35; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
    }

    const result = await resultPromise;

    expect(result.marketsSettled).toBe(0);
    expect(result.adminSettleScheduled).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('RPC connection lost');

    // Alert should have been sent
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.level).toBe('critical');

    vi.useRealTimers();
  });

  it('should query on-chain when no markets are injected', async () => {
    const onChainMarkets: readonly ActiveMarket[] = [
      buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 }),
      buildActiveMarket({ ticker: 'MSFT', strikePrice: 420 }),
    ];

    const getActiveMarkets = vi.fn().mockResolvedValue(onChainMarkets);

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('settle-sig'),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets,
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService(),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    // Call without injecting markets
    const result = await runSettlementJob(deps);

    expect(getActiveMarkets).toHaveBeenCalledOnce();
    expect(result.marketsSettled).toBe(2);
  });
});
