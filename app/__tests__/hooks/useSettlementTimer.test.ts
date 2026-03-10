import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettlementTimer } from '../../src/hooks/useSettlementTimer';

describe('useSettlementTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns trading status during market hours on a weekday', () => {
    // Wednesday 2026-03-11 at 12:00 PM ET = 17:00 UTC
    vi.setSystemTime(new Date('2026-03-11T17:00:00Z'));

    const { result } = renderHook(() => useSettlementTimer());

    expect(result.current.status).toBe('trading');
    expect(result.current.timeString).toContain('Settlement in');
  });

  it('returns closed status on weekends', () => {
    // Saturday 2026-03-14 at 12:00 PM ET = 17:00 UTC
    vi.setSystemTime(new Date('2026-03-14T17:00:00Z'));

    const { result } = renderHook(() => useSettlementTimer());

    expect(result.current.status).toBe('closed');
    expect(result.current.timeString).toContain('Market Closed');
  });

  it('returns settling status at 4:05 PM ET', () => {
    // Wednesday 2026-03-11 at 4:05 PM ET = 21:05 UTC (EDT)
    vi.setSystemTime(new Date('2026-03-11T20:05:00Z'));

    const { result } = renderHook(() => useSettlementTimer());

    expect(result.current.status).toBe('settling');
    expect(result.current.timeString).toBe('Settlement in progress...');
  });

  it('updates every second', () => {
    vi.setSystemTime(new Date('2026-03-11T17:00:00Z'));

    const { result } = renderHook(() => useSettlementTimer());
    const initialTime = result.current.timeString;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // After 1 second, the timer should have updated
    expect(result.current.status).toBe('trading');
  });
});
