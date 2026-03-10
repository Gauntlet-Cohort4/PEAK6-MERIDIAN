/**
 * @module adapters/types
 * Adapter interfaces for external service integrations.
 * Implementations are provided by the automation and app packages.
 */

import type { OrderBookState, PriceData } from '../types.js';

/** Health check result for an adapter. */
export interface HealthStatus {
  readonly healthy: boolean;
  readonly lastCheck: Date;
  readonly error?: string;
}

/** Parameters for placing an order through the order book adapter. */
export interface PlaceOrderParams {
  readonly marketAddress: string;
  readonly side: 'bid' | 'ask';
  readonly price: number;
  readonly size: number;
  readonly traderPublicKey: string;
}

/** Adapter for interacting with an on-chain order book (e.g., Phoenix). */
export interface OrderBookAdapter {
  /** Human-readable name of this adapter implementation. */
  name(): string;

  /** Place an order and return the transaction signature. */
  placeOrder(params: PlaceOrderParams): Promise<string>;

  /** Cancel an existing order by its ID. */
  cancelOrder(orderId: string): Promise<void>;

  /** Fetch the current order book snapshot for a market. */
  getOrderBook(marketAddress: string): Promise<OrderBookState>;

  /** Check the health of the underlying service connection. */
  health(): Promise<HealthStatus>;
}

/** Adapter for fetching price data from an oracle (e.g., Pyth). */
export interface PriceServiceAdapter {
  /** Get the latest price for a given feed. */
  getLatestPrice(feedId: string): Promise<PriceData>;

  /** Get the price at or near a specific historical timestamp. */
  getHistoricalPrice(feedId: string, timestamp: number): Promise<PriceData>;

  /** Check the health of the price service. */
  health(): Promise<HealthStatus>;
}

/** Adapter for determining trading day schedules. */
export interface TradingDayAdapter {
  /** Check whether a given date is a trading day. */
  isTradingDay(date: Date): Promise<boolean>;

  /** Get the next trading day on or after the given date. */
  getNextTradingDay(from: Date): Promise<Date>;

  /** Check the health of the trading day data source. */
  health(): Promise<HealthStatus>;
}
