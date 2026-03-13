import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettlementTimer } from '../../src/hooks/useSettlementTimer';

describe('useSettlementTimer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
    vi.resetModules();
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

  it('returns trading status with demo text when DEMO_MODE is true', async () => {
    // Weekend — normally closed
    vi.setSystemTime(new Date('2026-03-14T17:00:00Z'));
    process.env['NEXT_PUBLIC_DEMO_MODE'] = 'true';
    vi.resetModules();

    const { useSettlementTimer: useDemoTimer } = await import(
      '../../src/hooks/useSettlementTimer'
    );
    const { result } = renderHook(() => useDemoTimer());

    expect(result.current.status).toBe('trading');
    expect(result.current.timeString).toContain('Demo Mode');
  });
});
