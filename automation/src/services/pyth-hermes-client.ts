/**
 * @module pyth-hermes-client
 * Pyth Hermes + Benchmarks API wrapper implementing PriceServiceAdapter.
 * Fetches latest and historical prices with retry and exponential backoff.
 */

import type { PriceServiceAdapter, HealthStatus } from '@meridian/shared/adapters/types.js';
import type { PriceData } from '@meridian/shared/types.js';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors.js';
import { debugLog } from '@meridian/shared/debug.js';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('pyth-hermes');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/** Known Pyth feed ID for health checks (BTC/USD). */
const HEALTH_CHECK_FEED = 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

/** Configuration for the Pyth Hermes client. */
export interface PythHermesConfig {
  readonly hermesUrl: string;
  readonly benchmarksUrl: string;
}

/** Parsed price update from Pyth API response. */
interface PythPriceUpdate {
  readonly price: string;
  readonly conf: string;
  readonly publish_time: number;
  readonly expo: number;
}

/** Structure of a parsed Pyth API price entry. */
interface PythParsedEntry {
  readonly id: string;
  readonly price: PythPriceUpdate;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      debugLog('ORACLE_READS', 'pyth-hermes', operation, `Attempt ${attempt}/${MAX_RETRIES} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Parse a Pyth price update into a PriceData object.
 */
function parsePriceEntry(entry: PythParsedEntry): PriceData {
  const expo = entry.price.expo;
  const price = Number(entry.price.price) * Math.pow(10, expo);
  const confidence = Number(entry.price.conf) * Math.pow(10, expo);

  return Object.freeze({
    price,
    confidence,
    timestamp: entry.price.publish_time,
    feedId: entry.id,
    source: 'pyth-hermes',
  });
}

/**
 * Create a PriceServiceAdapter backed by Pyth Hermes and Benchmarks APIs.
 */
export function createPythHermesClient(
  config: PythHermesConfig,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): PriceServiceAdapter {
  const hermesBase = config.hermesUrl.replace(/\/$/, '');
  const benchmarksBase = config.benchmarksUrl.replace(/\/$/, '');

  async function getLatestPrice(feedId: string): Promise<PriceData> {
    debugLog('ORACLE_READS', 'pyth-hermes', 'getLatestPrice', 'Fetching latest price', { feedId });

    return withRetry(async () => {
      const url = `${hermesBase}/v2/updates/price/latest?ids[]=${feedId}`;
      const response = await fetchFn(url);

      if (!response.ok) {
        throw new MeridianError(
          MeridianErrorCode.PYTH_HERMES_ERROR,
          `Hermes API returned ${response.status}: ${response.statusText}`,
          undefined,
          { feedId, url },
        );
      }

      const body = await response.json() as { parsed: readonly PythParsedEntry[] };
      const entry = body.parsed[0];

      if (!entry) {
        throw new MeridianError(
          MeridianErrorCode.PYTH_HERMES_ERROR,
          `No price data returned for feed ${feedId}`,
          undefined,
          { feedId },
        );
      }

      const priceData = parsePriceEntry(entry);
      debugLog('ORACLE_READS', 'pyth-hermes', 'getLatestPrice', 'Price fetched', {
        feedId,
        price: priceData.price,
        confidence: priceData.confidence,
      });

      return priceData;
    }, 'getLatestPrice');
  }

  async function getHistoricalPrice(
    feedId: string,
    timestamp: number,
  ): Promise<PriceData> {
    debugLog('ORACLE_READS', 'pyth-hermes', 'getHistoricalPrice', 'Fetching historical price', {
      feedId,
      timestamp,
    });

    // Try Benchmarks API first, fall back to Hermes latest if unavailable.
    // Benchmarks uses "ids" param (no brackets), unlike Hermes "ids[]".
    try {
      return await withRetry(async () => {
        const url = `${benchmarksBase}/v1/updates/price/${timestamp}?ids=${feedId}`;
        const response = await fetchFn(url);

        if (!response.ok) {
          throw new MeridianError(
            MeridianErrorCode.PYTH_HERMES_ERROR,
            `Benchmarks API returned ${response.status}: ${response.statusText}`,
            undefined,
            { feedId, timestamp, url },
          );
        }

        const body = await response.json() as { parsed: readonly PythParsedEntry[] };
        const entry = body.parsed[0];

        if (!entry) {
          throw new MeridianError(
            MeridianErrorCode.PYTH_HERMES_ERROR,
            `No historical price data for feed ${feedId} at ${timestamp}`,
            undefined,
            { feedId, timestamp },
          );
        }

        const priceData = parsePriceEntry(entry);
        debugLog('ORACLE_READS', 'pyth-hermes', 'getHistoricalPrice', 'Historical price fetched', {
          feedId,
          timestamp,
          price: priceData.price,
        });

        return priceData;
      }, 'getHistoricalPrice');
    } catch {
      // Benchmarks API may not have equity historical data.
      // Fall back to Hermes latest price (acceptable for strike calculation
      // since the morning job runs before market open).
      logger.warn('getHistoricalPrice',
        `Benchmarks unavailable for feed ${feedId}, falling back to Hermes latest price`);
      return getLatestPrice(feedId);
    }
  }

  async function health(): Promise<HealthStatus> {
    try {
      await getLatestPrice(HEALTH_CHECK_FEED);
      return Object.freeze({
        healthy: true,
        lastCheck: new Date(),
      });
    } catch (err) {
      logger.warn('health', 'Pyth Hermes health check failed', { error: err });
      return Object.freeze({
        healthy: false,
        lastCheck: new Date(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { getLatestPrice, getHistoricalPrice, health };
}
