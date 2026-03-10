/**
 * Tests for demo mode services.
 */

import { describe, it, expect } from 'vitest';
import { createDemoPriceService, createDemoTradingDayService } from '../src/services/demo-mode.js';

describe('DemoPriceService', () => {
  const service = createDemoPriceService();

  describe('getLatestPrice', () => {
    it('should return a mock price for a known feed ID', async () => {
      const aaplFeedId = 'b3a83305180090ac564afcc05ad973e5d1b7e0d1e9a8cc2b495a1cf0a4026752';
      const result = await service.getLatestPrice(aaplFeedId);

      expect(result.price).toBe(185.50);
      expect(result.confidence).toBeCloseTo(0.1855);
      expect(result.feedId).toBe(aaplFeedId);
      expect(result.source).toBe('demo-mock');
    });

    it('should return default price for an unknown feed ID', async () => {
      const result = await service.getLatestPrice('unknown-feed');

      expect(result.price).toBe(100.0);
      expect(result.feedId).toBe('unknown-feed');
      expect(result.source).toBe('demo-mock');
    });

    it('should include a current timestamp', async () => {
      const before = Math.floor(Date.now() / 1000);
      const result = await service.getLatestPrice('any-feed');
      const after = Math.floor(Date.now() / 1000);

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('should return frozen PriceData', async () => {
      const result = await service.getLatestPrice('any-feed');
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('getHistoricalPrice', () => {
    it('should return mock price with the requested timestamp', async () => {
      const feedId = 'b3a83305180090ac564afcc05ad973e5d1b7e0d1e9a8cc2b495a1cf0a4026752';
      const timestamp = 1700000000;
      const result = await service.getHistoricalPrice(feedId, timestamp);

      expect(result.price).toBe(185.50);
      expect(result.timestamp).toBe(timestamp);
      expect(result.source).toBe('demo-mock');
    });
  });

  describe('health', () => {
    it('should always return healthy', async () => {
      const status = await service.health();
      expect(status.healthy).toBe(true);
    });
  });
});

describe('DemoTradingDayService', () => {
  const service = createDemoTradingDayService();

  describe('isTradingDay', () => {
    it('should always return true', async () => {
      // Even weekends should be "trading days" in demo mode
      const saturday = new Date('2026-03-07T12:00:00Z');
      expect(await service.isTradingDay(saturday)).toBe(true);
    });

    it('should return true for holidays too', async () => {
      const christmas = new Date('2026-12-25T12:00:00Z');
      expect(await service.isTradingDay(christmas)).toBe(true);
    });
  });

  describe('getNextTradingDay', () => {
    it('should return the same date passed in', async () => {
      const date = new Date('2026-03-10T12:00:00Z');
      const result = await service.getNextTradingDay(date);
      expect(result).toBe(date);
    });
  });

  describe('health', () => {
    it('should always return healthy', async () => {
      const status = await service.health();
      expect(status.healthy).toBe(true);
    });
  });
});
