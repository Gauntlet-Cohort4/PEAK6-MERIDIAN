/**
 * @module mock-factories
 * Shared mock factories for integration tests.
 * Provides reusable mock implementations of all external service adapters.
 */

import { vi } from 'vitest';
import type { PriceServiceAdapter, TradingDayAdapter, OrderBookAdapter, PlaceOrderParams } from '@meridian/shared/adapters/types.js';
import type { PriceData, OrderBookState } from '@meridian/shared/types.js';
import type { MeridianClient, CreateStrikeMarketParams, SetPhoenixMarketParams, SettleMarketParams, AdminSettleParams } from '../../../automation/src/services/meridian-client.js';
import type { AlertService } from '../../../automation/src/services/alert-service.js';
import type { ActiveMarket } from '../../../automation/src/types/active-market.js';
import type { MorningJobDeps } from '../../../automation/src/jobs/morning-job.js';
import type { SettlementJobDeps } from '../../../automation/src/jobs/settlement-job.js';
import type { SupportedTicker } from '@meridian/shared/constants.js';

// ---------------------------------------------------------------------------
// Price Data Builders
// ---------------------------------------------------------------------------

export function buildPriceData(overrides?: Partial<PriceData>): PriceData {
  return Object.freeze({
    price: 185.50,
    confidence: 0.185,
    timestamp: 1700000000,
    feedId: 'test-feed-id',
    source: 'test-mock',
    ...overrides,
  });
}

export function buildPriceDataForTicker(
  ticker: SupportedTicker,
  price: number,
): PriceData {
  const feedIds: Record<string, string> = {
    AAPL: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
    MSFT: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
    GOOGL: '5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6',
    AMZN: 'b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
    NVDA: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
    META: '78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
    TSLA: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  };

  return buildPriceData({
    price,
    confidence: price * 0.001,
    feedId: feedIds[ticker] ?? 'unknown-feed',
  });
}

// ---------------------------------------------------------------------------
// Active Market Builder
// ---------------------------------------------------------------------------

let marketCounter = 0;

/** Reset the market counter between test suites to prevent cross-test contamination. */
export function resetMarketCounter(): void {
  marketCounter = 0;
}

export function buildActiveMarket(overrides?: Partial<ActiveMarket>): ActiveMarket {
  marketCounter += 1;
  return Object.freeze({
    ticker: 'AAPL' as SupportedTicker,
    strikePrice: 190,
    marketAddress: `market-addr-${marketCounter}`,
    pythPriceAccount: `pyth-price-${marketCounter}`,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Service Mocks
// ---------------------------------------------------------------------------

export function createMockPriceService(overrides?: Partial<PriceServiceAdapter>): PriceServiceAdapter {
  return {
    getLatestPrice: vi.fn().mockResolvedValue(buildPriceData()),
    getHistoricalPrice: vi.fn().mockResolvedValue(buildPriceData()),
    health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    ...overrides,
  };
}

export function createMockTradingDayService(overrides?: Partial<TradingDayAdapter>): TradingDayAdapter {
  return {
    isTradingDay: vi.fn().mockResolvedValue(true),
    getNextTradingDay: vi.fn().mockResolvedValue(new Date()),
    health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
    ...overrides,
  };
}

/** Tracks all calls to the mock client for assertions. */
export interface MockMeridianClientTracker {
  readonly createdMarkets: readonly CreateStrikeMarketParams[];
  readonly settledMarkets: readonly SettleMarketParams[];
  readonly adminSettledMarkets: readonly AdminSettleParams[];
}

export function createMockMeridianClient(
  overrides?: Partial<MeridianClient>,
): { client: MeridianClient; tracker: MockMeridianClientTracker } {
  const createdMarkets: CreateStrikeMarketParams[] = [];
  const settledMarkets: SettleMarketParams[] = [];
  const adminSettledMarkets: AdminSettleParams[] = [];

  const client: MeridianClient = {
    createStrikeMarket: vi.fn().mockImplementation(async (params: CreateStrikeMarketParams) => {
      createdMarkets.push(params);
      return `mock-create-sig-${createdMarkets.length}`;
    }),
    setPhoenixMarket: vi.fn().mockResolvedValue('mock-set-phoenix-sig'),
    settleMarket: vi.fn().mockImplementation(async (params: SettleMarketParams) => {
      settledMarkets.push(params);
      return `mock-settle-sig-${settledMarkets.length}`;
    }),
    adminSettle: vi.fn().mockImplementation(async (params: AdminSettleParams) => {
      adminSettledMarkets.push(params);
      return `mock-admin-sig-${adminSettledMarkets.length}`;
    }),
    getActiveMarkets: vi.fn().mockResolvedValue([]),
    buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({
      instruction: {},
      strikeMarketAddress: 'mock-strike-market-addr',
      yesMintAddress: 'mock-yes-mint-addr',
    }),
    buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
    sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    ...overrides,
  };

  return {
    client,
    tracker: { createdMarkets, settledMarkets, adminSettledMarkets },
  };
}

export function createMockAlertService(): { service: AlertService; alerts: Array<{ level: string; title: string; details: Record<string, unknown> }> } {
  const alerts: Array<{ level: string; title: string; details: Record<string, unknown> }> = [];

  const service: AlertService = {
    sendAlert: vi.fn().mockImplementation(async (level: string, title: string, details: Record<string, unknown>) => {
      alerts.push({ level, title, details });
    }),
  };

  return { service, alerts };
}

export function createMockOrderBook(): OrderBookAdapter {
  return {
    name: () => 'mock-phoenix',
    placeOrder: vi.fn().mockResolvedValue('mock-order-sig'),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    getOrderBook: vi.fn().mockResolvedValue(Object.freeze({
      marketAddress: 'mock-market',
      bids: [{ price: 0.45, size: 100, side: 'bid' as const }],
      asks: [{ price: 0.55, size: 100, side: 'ask' as const }],
      lastUpdated: Date.now(),
      spread: 0.10,
    })),
    health: vi.fn().mockResolvedValue({ healthy: true, lastCheck: new Date() }),
  };
}

// ---------------------------------------------------------------------------
// Composite Dep Builders
// ---------------------------------------------------------------------------

export function buildMorningJobDeps(overrides?: Partial<MorningJobDeps>): MorningJobDeps {
  const { client } = createMockMeridianClient();
  const { service: alertService } = createMockAlertService();
  return {
    priceService: createMockPriceService(),
    tradingDayService: createMockTradingDayService(),
    meridianClient: client,
    alertService,
    ...overrides,
  };
}

export function buildSettlementJobDeps(overrides?: Partial<SettlementJobDeps>): SettlementJobDeps {
  const { client } = createMockMeridianClient();
  const { service } = createMockAlertService();
  return {
    priceService: createMockPriceService(),
    tradingDayService: createMockTradingDayService(),
    meridianClient: client,
    alertService: service,
    ...overrides,
  };
}
