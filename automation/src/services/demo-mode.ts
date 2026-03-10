/**
 * @module demo-mode
 * Demo mode implementations that return mock data instead of calling external APIs.
 * Used for local development and testing without real API credentials.
 */

import type { PriceServiceAdapter, TradingDayAdapter, HealthStatus } from '@meridian/shared/adapters/types.js';
import type { PriceData } from '@meridian/shared/types.js';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('demo-mode');

/** Mock price data for supported tickers (Pyth feed IDs to prices). */
const MOCK_PRICES: Readonly<Record<string, number>> = {
  // AAPL
  'b3a83305180090ac564afcc05ad973e5d1b7e0d1e9a8cc2b495a1cf0a4026752': 185.50,
  // MSFT
  'c2e03ef975e12b5e0de3cc609e3e5f7e1cf4a35d327f89b97e7d174ab0d1c7c8': 415.20,
  // GOOGL
  'e13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f': 174.80,
  // AMZN
  'a13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f': 198.30,
  // NVDA
  'b13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f': 875.60,
  // META
  'c13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f': 505.40,
  // TSLA
  'd13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f': 248.90,
};

const DEFAULT_MOCK_PRICE = 100.0;

/**
 * Create a mock PriceServiceAdapter for demo mode.
 * Returns deterministic mock prices without external API calls.
 */
export function createDemoPriceService(): PriceServiceAdapter {
  logger.info('createDemoPriceService', 'DEMO MODE ACTIVE: Using mock price data');

  async function getLatestPrice(feedId: string): Promise<PriceData> {
    const price = MOCK_PRICES[feedId] ?? DEFAULT_MOCK_PRICE;

    logger.info('getLatestPrice', `[DEMO] Returning mock price for ${feedId}`, {
      context: { feedId, price },
    });

    return Object.freeze({
      price,
      confidence: price * 0.001, // 0.1% confidence band
      timestamp: Math.floor(Date.now() / 1000),
      feedId,
      source: 'demo-mock',
    });
  }

  async function getHistoricalPrice(
    feedId: string,
    timestamp: number,
  ): Promise<PriceData> {
    const price = MOCK_PRICES[feedId] ?? DEFAULT_MOCK_PRICE;

    logger.info('getHistoricalPrice', `[DEMO] Returning mock historical price for ${feedId}`, {
      context: { feedId, timestamp, price },
    });

    return Object.freeze({
      price,
      confidence: price * 0.001,
      timestamp,
      feedId,
      source: 'demo-mock',
    });
  }

  async function health(): Promise<HealthStatus> {
    return Object.freeze({
      healthy: true,
      lastCheck: new Date(),
    });
  }

  return { getLatestPrice, getHistoricalPrice, health };
}

/**
 * Create a mock TradingDayAdapter for demo mode.
 * Always reports the current day as a trading day.
 */
export function createDemoTradingDayService(): TradingDayAdapter {
  logger.info('createDemoTradingDayService', 'DEMO MODE ACTIVE: Always reporting trading day as true');

  async function isTradingDay(_date: Date): Promise<boolean> {
    logger.info('isTradingDay', '[DEMO] Returning true for trading day check');
    return true;
  }

  async function getNextTradingDay(from: Date): Promise<Date> {
    logger.info('getNextTradingDay', '[DEMO] Returning provided date as next trading day');
    return from;
  }

  async function health(): Promise<HealthStatus> {
    return Object.freeze({
      healthy: true,
      lastCheck: new Date(),
    });
  }

  return { isTradingDay, getNextTradingDay, health };
}
