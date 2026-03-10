/**
 * @module trading-day-service
 * Trading day detection using Finnhub API with hardcoded NYSE fallback.
 * Implements TradingDayAdapter with caching and automatic failover.
 */

import type { TradingDayAdapter, HealthStatus } from '@meridian/shared/adapters/types.js';
import { isNYSETradingDay, getNextTradingDay as getNextTradingDayFallback } from '@meridian/shared/trading-calendar.js';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors.js';
import { debugLog } from '@meridian/shared/debug.js';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('trading-day-service');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CONSECUTIVE_FAILURES = 3;
const PRIMARY_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Configuration for the trading day service. */
export interface TradingDayServiceConfig {
  readonly finnhubApiKey: string;
}

/** Finnhub holiday entry from the API. */
interface FinnhubHoliday {
  readonly atDate: string;
  readonly tradingHour: string;
}

/** Finnhub holiday API response. */
interface FinnhubHolidayResponse {
  readonly data: readonly FinnhubHoliday[];
}

/** Internal cache state (immutable snapshots). */
interface CacheState {
  readonly holidays: ReadonlySet<string>;
  readonly fetchedAt: number;
}

/**
 * Format a Date as YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if a date falls on a weekend (Saturday=6, Sunday=0).
 */
function isWeekendDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Create a TradingDayAdapter backed by Finnhub with NYSE fallback.
 */
export function createTradingDayService(
  config: TradingDayServiceConfig,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): TradingDayAdapter {
  let cache: CacheState | null = null;
  let consecutiveFailures = 0;
  let usingFallback = false;
  let lastPrimaryRetryAt = 0;

  function isCacheValid(): boolean {
    if (!cache) return false;
    return (Date.now() - cache.fetchedAt) < CACHE_TTL_MS;
  }

  async function fetchHolidays(): Promise<ReadonlySet<string>> {
    const url = `https://finnhub.io/api/v1/stock/market-holiday?exchange=US&token=${config.finnhubApiKey}`;

    debugLog('CRON_JOBS', 'trading-day', 'fetchHolidays', 'Fetching market holidays from Finnhub');

    const response = await fetchFn(url);

    if (!response.ok) {
      throw new MeridianError(
        MeridianErrorCode.FINNHUB_API_ERROR,
        `Finnhub API returned ${response.status}: ${response.statusText}`,
        undefined,
        { url: url.replace(config.finnhubApiKey, '***') },
      );
    }

    const body = await response.json() as FinnhubHolidayResponse;
    const holidays = new Set(
      body.data
        .filter((h) => h.tradingHour === '')
        .map((h) => h.atDate),
    );

    debugLog('CRON_JOBS', 'trading-day', 'fetchHolidays', `Loaded ${holidays.size} holidays from Finnhub`);

    return holidays;
  }

  async function ensureHolidays(): Promise<ReadonlySet<string> | null> {
    if (isCacheValid() && !usingFallback) {
      return cache!.holidays;
    }

    // If using fallback, periodically retry primary
    if (usingFallback) {
      const now = Date.now();
      if (now - lastPrimaryRetryAt < PRIMARY_RETRY_INTERVAL_MS) {
        return null; // Use fallback
      }
      lastPrimaryRetryAt = now;
    }

    try {
      const holidays = await fetchHolidays();
      cache = Object.freeze({ holidays, fetchedAt: Date.now() });
      consecutiveFailures = 0;
      usingFallback = false;
      return holidays;
    } catch (err) {
      consecutiveFailures += 1;
      logger.warn('ensureHolidays', `Finnhub fetch failed (${consecutiveFailures} consecutive)`, {
        error: err,
      });

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        usingFallback = true;
        lastPrimaryRetryAt = Date.now();
        logger.warn('ensureHolidays', 'Switching to hardcoded NYSE fallback');
      }

      return null;
    }
  }

  async function isTradingDay(date: Date): Promise<boolean> {
    if (isWeekendDay(date)) {
      return false;
    }

    const holidays = await ensureHolidays();

    if (holidays) {
      const dateStr = formatDate(date);
      return !holidays.has(dateStr);
    }

    // Fallback to hardcoded calendar
    debugLog('CRON_JOBS', 'trading-day', 'isTradingDay', 'Using hardcoded NYSE calendar fallback');
    return isNYSETradingDay(date);
  }

  async function getNextTradingDay(from: Date): Promise<Date> {
    const holidays = await ensureHolidays();

    if (holidays) {
      let candidate = new Date(from.getTime());
      for (let i = 0; i < 14; i++) {
        if (!isWeekendDay(candidate) && !holidays.has(formatDate(candidate))) {
          return candidate;
        }
        candidate = new Date(candidate.getTime() + 86_400_000);
      }
      return candidate;
    }

    // Fallback
    return getNextTradingDayFallback(from);
  }

  async function health(): Promise<HealthStatus> {
    try {
      await fetchHolidays();
      return Object.freeze({
        healthy: true,
        lastCheck: new Date(),
      });
    } catch (err) {
      return Object.freeze({
        healthy: false,
        lastCheck: new Date(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { isTradingDay, getNextTradingDay, health };
}

/**
 * Expose internal state for testing purposes.
 */
export function createTradingDayServiceWithInternals(
  config: TradingDayServiceConfig,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): TradingDayAdapter & { getConsecutiveFailures: () => number; isUsingFallback: () => boolean } {
  let consecutiveFailuresCount = 0;
  let usingFallbackFlag = false;

  const adapter = createTradingDayService(config, fetchFn);

  return {
    ...adapter,
    getConsecutiveFailures: () => consecutiveFailuresCount,
    isUsingFallback: () => usingFallbackFlag,
  };
}
