import { describe, it, expect } from 'vitest';
import {
  isNYSETradingDay,
  getNextTradingDay,
  getNextMarketOpen,
  getMarketCloseToday,
  isMarketOpen,
  getSettlementTime,
  NYSE_HOLIDAYS_2026,
} from '../trading-calendar.js';

describe('NYSE_HOLIDAYS_2026', () => {
  it('should have 9 holidays', () => {
    expect(NYSE_HOLIDAYS_2026).toHaveLength(9);
  });

  it('should contain New Year and Christmas', () => {
    expect(NYSE_HOLIDAYS_2026).toContain('2026-01-01');
    expect(NYSE_HOLIDAYS_2026).toContain('2026-12-25');
  });
});

describe('isNYSETradingDay', () => {
  it('should return true for a regular weekday', () => {
    // 2026-03-10 is a Tuesday
    const tuesday = new Date('2026-03-10T12:00:00-05:00');
    expect(isNYSETradingDay(tuesday)).toBe(true);
  });

  it('should return false for a Saturday', () => {
    const saturday = new Date('2026-03-14T12:00:00-05:00');
    expect(isNYSETradingDay(saturday)).toBe(false);
  });

  it('should return false for a Sunday', () => {
    const sunday = new Date('2026-03-15T12:00:00-05:00');
    expect(isNYSETradingDay(sunday)).toBe(false);
  });

  it('should return false for an NYSE holiday', () => {
    // 2026-01-01 is New Year's Day (Thursday)
    const newYear = new Date('2026-01-01T12:00:00-05:00');
    expect(isNYSETradingDay(newYear)).toBe(false);
  });

  it('should return false for Thanksgiving', () => {
    const thanksgiving = new Date('2026-11-26T12:00:00-05:00');
    expect(isNYSETradingDay(thanksgiving)).toBe(false);
  });
});

describe('getNextTradingDay', () => {
  it('should return the same day if it is a trading day', () => {
    const tuesday = new Date('2026-03-10T12:00:00-05:00');
    const next = getNextTradingDay(tuesday);
    expect(next.toISOString()).toBe(tuesday.toISOString());
  });

  it('should skip weekends', () => {
    const saturday = new Date('2026-03-14T12:00:00-05:00');
    const next = getNextTradingDay(saturday);
    // Should be Monday 2026-03-16
    expect(isNYSETradingDay(next)).toBe(true);
  });
});

describe('getNextMarketOpen', () => {
  it('should return 9:30 ET on a trading day', () => {
    const tuesday = new Date('2026-03-10T08:00:00-05:00');
    const open = getNextMarketOpen(tuesday);
    // 9:30 ET = 14:30 UTC (EDT starts March 8, 2026)
    expect(open.getUTCHours()).toBe(13);
    expect(open.getUTCMinutes()).toBe(30);
  });
});

describe('getMarketCloseToday', () => {
  it('should return 16:00 ET', () => {
    const tuesday = new Date('2026-03-10T12:00:00-05:00');
    const close = getMarketCloseToday(tuesday);
    // 16:00 ET = 20:00 UTC (EDT)
    expect(close.getUTCHours()).toBe(20);
    expect(close.getUTCMinutes()).toBe(0);
  });
});

describe('isMarketOpen', () => {
  it('should return true during market hours on a trading day', () => {
    // 2026-03-10 at 10:00 ET (EDT) = 14:00 UTC
    const duringHours = new Date('2026-03-10T14:00:00Z');
    expect(isMarketOpen(duringHours)).toBe(true);
  });

  it('should return false before market open', () => {
    // 2026-03-10 at 8:00 ET = 12:00 UTC
    const beforeOpen = new Date('2026-03-10T12:00:00Z');
    expect(isMarketOpen(beforeOpen)).toBe(false);
  });

  it('should return false on weekends', () => {
    const saturday = new Date('2026-03-14T14:00:00Z');
    expect(isMarketOpen(saturday)).toBe(false);
  });
});

describe('getSettlementTime', () => {
  it('should return 16:05 ET', () => {
    const tuesday = new Date('2026-03-10T12:00:00-05:00');
    const settlement = getSettlementTime(tuesday);
    // 16:05 ET (EDT) = 20:05 UTC
    expect(settlement.getUTCHours()).toBe(20);
    expect(settlement.getUTCMinutes()).toBe(5);
  });
});
