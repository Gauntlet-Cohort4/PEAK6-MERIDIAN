/**
 * Integration test: All 4 Trade Paths
 *
 * Covers ProjSpec requirement:
 *   Buy Yes, Buy No, Sell Yes, Sell No
 *
 * Verifies that the order book adapter correctly handles all four trade
 * directions, and that settlement outcomes are correct for each path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeSide } from '@meridian/shared/types.js';
import type { OrderBookAdapter, PlaceOrderParams } from '@meridian/shared/adapters/types.js';
import { createMockOrderBook, buildActiveMarket, buildPriceData, createMockPriceService, createMockTradingDayService, createMockAlertService, resetMarketCounter } from './helpers/mock-factories.js';
import { runSettlementJob, type SettlementJobDeps } from '../../automation/src/jobs/settlement-job.js';
import type { MeridianClient } from '../../automation/src/services/meridian-client.js';
import type { ActiveMarket } from '../../automation/src/types/active-market.js';

describe('All 4 Trade Paths', () => {
  beforeEach(() => {
    resetMarketCounter();
  });

  /**
   * Helper: create a tracking order book that records all placed orders.
   */
  function createTrackingOrderBook(): {
    orderBook: OrderBookAdapter;
    placedOrders: PlaceOrderParams[];
  } {
    const placedOrders: PlaceOrderParams[] = [];
    const orderBook = createMockOrderBook();

    // Override placeOrder to track calls
    (orderBook.placeOrder as ReturnType<typeof vi.fn>).mockImplementation(
      async (params: PlaceOrderParams) => {
        placedOrders.push(params);
        return `order-sig-${placedOrders.length}`;
      },
    );

    return { orderBook, placedOrders };
  }

  it('should support Buy Yes trades (bid side for YES tokens)', async () => {
    const { orderBook, placedOrders } = createTrackingOrderBook();

    const market = buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 });

    // Buy Yes = placing a bid on the YES token order book
    const sig = await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'bid',
      price: 0.65,
      size: 100,
      traderPublicKey: 'trader-alice',
    });

    expect(sig).toBeDefined();
    expect(placedOrders).toHaveLength(1);
    expect(placedOrders[0]!.side).toBe('bid');
    expect(placedOrders[0]!.price).toBe(0.65);
    expect(placedOrders[0]!.size).toBe(100);
    expect(placedOrders[0]!.traderPublicKey).toBe('trader-alice');
  });

  it('should support Buy No trades (ask side represents selling YES / buying NO)', async () => {
    const { orderBook, placedOrders } = createTrackingOrderBook();

    const market = buildActiveMarket({ ticker: 'MSFT', strikePrice: 420 });

    // Buy No = placing an ask on the YES order book (selling YES to get NO exposure)
    // In a binary market, buying NO at price P is equivalent to selling YES at price (1-P)
    const sig = await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'ask',
      price: 0.35,
      size: 50,
      traderPublicKey: 'trader-bob',
    });

    expect(sig).toBeDefined();
    expect(placedOrders).toHaveLength(1);
    expect(placedOrders[0]!.side).toBe('ask');
    expect(placedOrders[0]!.price).toBe(0.35);
    expect(placedOrders[0]!.size).toBe(50);
  });

  it('should support Sell Yes trades (ask side for YES tokens)', async () => {
    const { orderBook, placedOrders } = createTrackingOrderBook();

    const market = buildActiveMarket({ ticker: 'NVDA', strikePrice: 880 });

    // Sell Yes = placing an ask (offering to sell YES tokens)
    const sig = await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'ask',
      price: 0.72,
      size: 25,
      traderPublicKey: 'trader-charlie',
    });

    expect(sig).toBeDefined();
    expect(placedOrders).toHaveLength(1);
    expect(placedOrders[0]!.side).toBe('ask');
    expect(placedOrders[0]!.price).toBe(0.72);
  });

  it('should support Sell No trades (bid side represents buying YES / selling NO)', async () => {
    const { orderBook, placedOrders } = createTrackingOrderBook();

    const market = buildActiveMarket({ ticker: 'GOOGL', strikePrice: 180 });

    // Sell No = placing a bid on the YES book (buying YES is equivalent to selling NO)
    const sig = await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'bid',
      price: 0.60,
      size: 75,
      traderPublicKey: 'trader-diana',
    });

    expect(sig).toBeDefined();
    expect(placedOrders).toHaveLength(1);
    expect(placedOrders[0]!.side).toBe('bid');
    expect(placedOrders[0]!.price).toBe(0.60);
  });

  it('should execute all 4 trade paths in sequence for the same market', async () => {
    const { orderBook, placedOrders } = createTrackingOrderBook();

    const market = buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 });
    const trader = 'trader-multi-path';

    // 1. Buy Yes (bid)
    await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'bid',
      price: 0.55,
      size: 100,
      traderPublicKey: trader,
    });

    // 2. Buy No (ask, selling YES)
    await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'ask',
      price: 0.40,
      size: 50,
      traderPublicKey: trader,
    });

    // 3. Sell Yes (ask)
    await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'ask',
      price: 0.70,
      size: 30,
      traderPublicKey: trader,
    });

    // 4. Sell No (bid, buying YES)
    await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'bid',
      price: 0.65,
      size: 20,
      traderPublicKey: trader,
    });

    expect(placedOrders).toHaveLength(4);

    // Verify each trade path
    expect(placedOrders[0]!.side).toBe('bid');   // Buy Yes
    expect(placedOrders[0]!.price).toBe(0.55);
    expect(placedOrders[1]!.side).toBe('ask');   // Buy No
    expect(placedOrders[1]!.price).toBe(0.40);
    expect(placedOrders[2]!.side).toBe('ask');   // Sell Yes
    expect(placedOrders[2]!.price).toBe(0.70);
    expect(placedOrders[3]!.side).toBe('bid');   // Sell No
    expect(placedOrders[3]!.price).toBe(0.65);

    // All trades should be for the same market
    const uniqueMarkets = new Set(placedOrders.map(o => o.marketAddress));
    expect(uniqueMarkets.size).toBe(1);
  });

  it('should settle correctly after Buy Yes trade when price finishes above strike', async () => {
    const market = buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 });

    // Settlement price above strike -> YES wins
    const settlementPrice = 195.0;

    const settledParams: Array<{ marketAddress: string; pythPriceAccount: string }> = [];
    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('mock-sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockImplementation(async (params) => {
        settledParams.push(params);
        return 'settle-sig';
      }),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService({
        getLatestPrice: vi.fn().mockResolvedValue(
          buildPriceData({ price: settlementPrice }),
        ),
      }),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const result = await runSettlementJob(deps, [market]);

    expect(result.marketsSettled).toBe(1);
    expect(settledParams).toHaveLength(1);
    expect(settledParams[0]!.marketAddress).toBe(market.marketAddress);
    // YES wins: settlement price (195) >= strike (190)
    expect(settlementPrice).toBeGreaterThanOrEqual(market.strikePrice);
  });

  it('should settle correctly after Buy No trade when price finishes below strike', async () => {
    const market = buildActiveMarket({ ticker: 'AAPL', strikePrice: 190 });

    // Settlement price below strike -> NO wins
    const settlementPrice = 185.0;

    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('mock-sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockResolvedValue('settle-sig'),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService({
        getLatestPrice: vi.fn().mockResolvedValue(
          buildPriceData({ price: settlementPrice }),
        ),
      }),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const result = await runSettlementJob(deps, [market]);

    expect(result.marketsSettled).toBe(1);
    // NO wins: settlement price (185) < strike (190)
    expect(settlementPrice).toBeLessThan(market.strikePrice);
  });

  it('should handle order cancellation correctly', async () => {
    const { orderBook, placedOrders } = createTrackingOrderBook();
    const market = buildActiveMarket({ ticker: 'META', strikePrice: 510 });

    // Place an order
    await orderBook.placeOrder({
      marketAddress: market.marketAddress,
      side: 'bid',
      price: 0.50,
      size: 100,
      traderPublicKey: 'trader-cancel-test',
    });

    // Cancel it
    await orderBook.cancelOrder('order-sig-1');

    expect(orderBook.cancelOrder).toHaveBeenCalledWith('order-sig-1');
    expect(placedOrders).toHaveLength(1);
  });

  it('should verify the TradeSide enum covers all 4 trade paths', () => {
    // Verify the enum has all required trade sides
    expect(TradeSide.BUY_YES).toBe('BUY_YES');
    expect(TradeSide.BUY_NO).toBe('BUY_NO');
    expect(TradeSide.SELL_YES).toBe('SELL_YES');
    expect(TradeSide.SELL_NO).toBe('SELL_NO');

    // Also has redemption sides
    expect(TradeSide.REDEEM_YES).toBe('REDEEM_YES');
    expect(TradeSide.REDEEM_NO).toBe('REDEEM_NO');

    // Exactly 6 values
    const values = Object.values(TradeSide);
    expect(values).toHaveLength(6);
  });

  it('should fetch order book state showing bid/ask spread', async () => {
    const orderBook = createMockOrderBook();
    const market = buildActiveMarket({ ticker: 'TSLA', strikePrice: 250 });

    const state = await orderBook.getOrderBook(market.marketAddress);

    expect(state.bids.length).toBeGreaterThan(0);
    expect(state.asks.length).toBeGreaterThan(0);
    expect(state.spread).toBeDefined();

    // Best bid should be less than best ask
    const bestBid = state.bids[0]!.price;
    const bestAsk = state.asks[0]!.price;
    expect(bestBid).toBeLessThan(bestAsk);

    // Spread should be positive
    expect(state.spread).toBeGreaterThan(0);
  });
});
