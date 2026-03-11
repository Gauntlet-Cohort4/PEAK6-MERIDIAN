/**
 * @module trading-calendar
 * NYSE trading calendar utilities for determining market hours and trading days.
 * All times are in the America/New_York timezone.
 */

import { addDays, isWeekend, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { MERIDIAN_CONFIG } from './constants';

const NY_TZ = 'America/New_York';

/** NYSE holidays for 2026 (YYYY-MM-DD format). */
export const NYSE_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
] as const;

const holidaySet: ReadonlySet<string> = new Set(NYSE_HOLIDAYS_2026);

/**
 * Format a Date as YYYY-MM-DD in New York time.
 */
function formatDateNY(date: Date): string {
  const ny = toZonedTime(date, NY_TZ);
  const y = ny.getFullYear();
  const m = String(ny.getMonth() + 1).padStart(2, '0');
  const d = String(ny.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check whether a given date falls on an NYSE trading day.
 * A trading day is a weekday that is not an NYSE holiday.
 */
export function isNYSETradingDay(date: Date): boolean {
  const ny = toZonedTime(date, NY_TZ);
  if (isWeekend(ny)) {
    return false;
  }
  return !holidaySet.has(formatDateNY(date));
}

/**
 * Get the next NYSE trading day on or after the given date.
 * If the given date is itself a trading day, it is returned.
 */
export function getNextTradingDay(from: Date): Date {
  let candidate = from;
  // Safety: limit iterations to avoid infinite loop
  for (let i = 0; i < 14; i++) {
    if (isNYSETradingDay(candidate)) {
      return candidate;
    }
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

/**
 * Get the next market open time (9:30 ET) on or after the given date.
 * Returns a UTC Date representing the open instant.
 */
export function getNextMarketOpen(from: Date): Date {
  const tradingDay = getNextTradingDay(from);
  const nyDate = toZonedTime(tradingDay, NY_TZ);
  const dayStart = startOfDay(nyDate);
  const openNY = new Date(dayStart.getTime());
  openNY.setHours(MERIDIAN_CONFIG.MARKET_OPEN_HOUR, MERIDIAN_CONFIG.MARKET_OPEN_MINUTE, 0, 0);
  return fromZonedTime(openNY, NY_TZ);
}

/**
 * Get today's market close time (16:00 ET) for the given date.
 * Returns a UTC Date. Does not check whether the day is a trading day.
 */
export function getMarketCloseToday(date: Date): Date {
  const nyDate = toZonedTime(date, NY_TZ);
  const dayStart = startOfDay(nyDate);
  const closeNY = new Date(dayStart.getTime());
  closeNY.setHours(MERIDIAN_CONFIG.MARKET_CLOSE_HOUR, MERIDIAN_CONFIG.MARKET_CLOSE_MINUTE, 0, 0);
  return fromZonedTime(closeNY, NY_TZ);
}

/**
 * Check whether the market is currently open.
 * Requires the current date to be a trading day and the time
 * to be between 9:30 and 16:00 ET.
 */
export function isMarketOpen(now: Date): boolean {
  if (!isNYSETradingDay(now)) {
    return false;
  }
  const open = getNextMarketOpen(now);
  const close = getMarketCloseToday(now);
  return now >= open && now < close;
}

/**
 * Get the settlement time for a trading day.
 * Settlement occurs at SETTLEMENT_JOB_HOUR:SETTLEMENT_JOB_MINUTE ET.
 */
export function getSettlementTime(date: Date): Date {
  const nyDate = toZonedTime(date, NY_TZ);
  const dayStart = startOfDay(nyDate);
  const settlementNY = new Date(dayStart.getTime());
  settlementNY.setHours(
    MERIDIAN_CONFIG.SETTLEMENT_JOB_HOUR,
    MERIDIAN_CONFIG.SETTLEMENT_JOB_MINUTE,
    0,
    0,
  );
  return fromZonedTime(settlementNY, NY_TZ);
}
