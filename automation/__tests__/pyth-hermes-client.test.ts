/**
 * Tests for the Pyth Hermes client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPythHermesClient } from '../src/services/pyth-hermes-client.js';

const TEST_FEED_ID = 'abc123';

function mockPythResponse(price: string, conf: string, expo: number, publishTime: number) {
  return {
    parsed: [
      {
        id: TEST_FEED_ID,
        price: {
          price,
          conf,
          publish_time: publishTime,
          expo,
        },
      },
    ],
  };
}

function createMockFetch(responseBody: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(responseBody),
  });
}

describe('PythHermesClient', () => {
  const config = {
    hermesUrl: 'https://hermes.test.pyth.network',
    benchmarksUrl: 'https://benchmarks.test.pyth.network',
  };

  describe('getLatestPrice', () => {
    it('should fetch and parse latest price correctly', async () => {
      const body = mockPythResponse('18550000000', '1000000', -8, 1700000000);
      const mockFetch = createMockFetch(body);
      const client = createPythHermesClient(config, mockFetch);

      const result = await client.getLatestPrice(TEST_FEED_ID);

      expect(result.price).toBeCloseTo(185.5);
      expect(result.confidence).toBeCloseTo(0.01);
      expect(result.timestamp).toBe(1700000000);
      expect(result.feedId).toBe(TEST_FEED_ID);
      expect(result.source).toBe('pyth-hermes');
    });

    it('should call the correct Hermes URL', async () => {
      const body = mockPythResponse('10000000000', '100000', -8, 1700000000);
      const mockFetch = createMockFetch(body);
      const client = createPythHermesClient(config, mockFetch);

      await client.getLatestPrice(TEST_FEED_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://hermes.test.pyth.network/v2/updates/price/latest?ids[]=${TEST_FEED_ID}`,
      );
    });

    it('should throw on non-200 response after retries', async () => {
      const mockFetch = createMockFetch({}, 500);
      const client = createPythHermesClient(config, mockFetch);

      await expect(client.getLatestPrice(TEST_FEED_ID)).rejects.toThrow('Hermes API returned 500');
      expect(mockFetch).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });

    it('should throw when no price data returned', async () => {
      const mockFetch = createMockFetch({ parsed: [] });
      const client = createPythHermesClient(config, mockFetch);

      await expect(client.getLatestPrice(TEST_FEED_ID)).rejects.toThrow('No price data returned');
    });

    it('should retry on fetch failure', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPythResponse('18550000000', '1000000', -8, 1700000000)),
        });
      });

      const client = createPythHermesClient(config, mockFetch);
      const result = await client.getLatestPrice(TEST_FEED_ID);

      expect(result.price).toBeCloseTo(185.5);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should return frozen PriceData object', async () => {
      const body = mockPythResponse('18550000000', '1000000', -8, 1700000000);
      const mockFetch = createMockFetch(body);
      const client = createPythHermesClient(config, mockFetch);

      const result = await client.getLatestPrice(TEST_FEED_ID);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('getHistoricalPrice', () => {
    it('should fetch and parse historical price correctly', async () => {
      const body = mockPythResponse('41520000000', '2000000', -8, 1699900000);
      const mockFetch = createMockFetch(body);
      const client = createPythHermesClient(config, mockFetch);

      const result = await client.getHistoricalPrice(TEST_FEED_ID, 1699900000);

      expect(result.price).toBeCloseTo(415.2);
      expect(result.timestamp).toBe(1699900000);
    });

    it('should call the correct Benchmarks URL', async () => {
      const body = mockPythResponse('10000000000', '100000', -8, 1699900000);
      const mockFetch = createMockFetch(body);
      const client = createPythHermesClient(config, mockFetch);

      await client.getHistoricalPrice(TEST_FEED_ID, 1699900000);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://benchmarks.test.pyth.network/v1/updates/price/1699900000?ids[]=${TEST_FEED_ID}`,
      );
    });

    it('should throw on API error after retries', async () => {
      const mockFetch = createMockFetch({}, 404);
      const client = createPythHermesClient(config, mockFetch);

      await expect(client.getHistoricalPrice(TEST_FEED_ID, 1699900000)).rejects.toThrow(
        'Benchmarks API returned 404',
      );
    });
  });

  describe('health', () => {
    it('should return healthy when price fetch succeeds', async () => {
      const body = mockPythResponse('10000000000', '100000', -8, 1700000000);
      const mockFetch = createMockFetch(body);
      const client = createPythHermesClient(config, mockFetch);

      const status = await client.health();

      expect(status.healthy).toBe(true);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });

    it('should return unhealthy when price fetch fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const client = createPythHermesClient(config, mockFetch);

      const status = await client.health();

      expect(status.healthy).toBe(false);
      expect(status.error).toBeDefined();
    });
  });
});
