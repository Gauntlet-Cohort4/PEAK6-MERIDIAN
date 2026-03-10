/**
 * Tests for the trading day service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTradingDayService } from '../src/services/trading-day-service.js';

/** Create a mock Finnhub API response. */
function mockFinnhubResponse(holidays: Array<{ atDate: string; tradingHour: string }>) {
  return { data: holidays };
}

function createMockFetch(responseBody: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(responseBody),
  });
}

const config = { finnhubApiKey: 'test-api-key' };

describe('TradingDayService', () => {
  describe('isTradingDay', () => {
    it('should return true for a regular weekday', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      // 2026-03-10 is a Tuesday
      const result = await service.isTradingDay(new Date('2026-03-10T12:00:00Z'));
      expect(result).toBe(true);
    });

    it('should return false for a weekend (Saturday)', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      // 2026-03-07 is a Saturday
      const result = await service.isTradingDay(new Date('2026-03-07T12:00:00Z'));
      expect(result).toBe(false);
    });

    it('should return false for a weekend (Sunday)', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      // 2026-03-08 is a Sunday
      const result = await service.isTradingDay(new Date('2026-03-08T12:00:00Z'));
      expect(result).toBe(false);
    });

    it('should return false for a holiday', async () => {
      const holidays = mockFinnhubResponse([
        { atDate: '2026-12-25', tradingHour: '' },
      ]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      // 2026-12-25 is Christmas (Friday)
      const result = await service.isTradingDay(new Date('2026-12-25T12:00:00Z'));
      expect(result).toBe(false);
    });

    it('should treat partial trading days as trading days', async () => {
      const holidays = mockFinnhubResponse([
        { atDate: '2026-11-27', tradingHour: '09:30-13:00' },
      ]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      // Partial day should still count as a trading day (tradingHour not empty)
      const result = await service.isTradingDay(new Date('2026-11-27T12:00:00Z'));
      expect(result).toBe(true);
    });

    it('should cache API results', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      await service.isTradingDay(new Date('2026-03-10T12:00:00Z'));
      await service.isTradingDay(new Date('2026-03-11T12:00:00Z'));

      // Should only fetch once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fall back to hardcoded calendar after 3 failures', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });
      const service = createTradingDayService(config, mockFetch);

      // Call 3 times to trigger fallback
      await service.isTradingDay(new Date('2026-03-10T12:00:00Z'));
      await service.isTradingDay(new Date('2026-03-10T12:00:00Z'));
      const result = await service.isTradingDay(new Date('2026-03-10T12:00:00Z'));

      // Tuesday should be a trading day even via fallback
      expect(result).toBe(true);
    });

    it('should call Finnhub API with correct URL', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      await service.isTradingDay(new Date('2026-03-10T12:00:00Z'));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://finnhub.io/api/v1/stock/market-holiday?exchange=US&token=test-api-key',
      );
    });
  });

  describe('getNextTradingDay', () => {
    it('should return same date if it is a trading day', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      const tuesday = new Date('2026-03-10T12:00:00Z');
      const result = await service.getNextTradingDay(tuesday);

      expect(result.getTime()).toBe(tuesday.getTime());
    });

    it('should skip weekends', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      const saturday = new Date('2026-03-07T12:00:00Z');
      const result = await service.getNextTradingDay(saturday);

      // Should return Monday March 9
      expect(result.getDay()).not.toBe(0);
      expect(result.getDay()).not.toBe(6);
    });

    it('should fall back when API fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const service = createTradingDayService(config, mockFetch);

      // Should not throw, should use fallback
      const tuesday = new Date('2026-03-10T12:00:00Z');
      const result = await service.getNextTradingDay(tuesday);
      expect(result).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return healthy when API is accessible', async () => {
      const holidays = mockFinnhubResponse([]);
      const mockFetch = createMockFetch(holidays);
      const service = createTradingDayService(config, mockFetch);

      const status = await service.health();
      expect(status.healthy).toBe(true);
    });

    it('should return unhealthy when API fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const service = createTradingDayService(config, mockFetch);

      const status = await service.health();
      expect(status.healthy).toBe(false);
      expect(status.error).toBeDefined();
    });
  });
});
