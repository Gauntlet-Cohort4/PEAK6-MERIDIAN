'use client';

import { useState, useEffect, useCallback } from 'react';
import { addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  isNYSETradingDay,
  getNextTradingDay,
} from '@meridian/shared/trading-calendar';
import { MERIDIAN_CONFIG } from '@meridian/shared/constants';

const NY_TZ = 'America/New_York';

export type TimerStatus = 'trading' | 'settling' | 'closed';

export interface SettlementTimerState {
  readonly timeString: string;
  readonly status: TimerStatus;
  readonly nextOpen: Date | null;
}

function padTwo(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

function getMarketTimes(now: Date): {
  open: Date;
  close: Date;
  settleEnd: Date;
} {
  const ny = toZonedTime(now, NY_TZ);
  const dayStart = new Date(ny.getFullYear(), ny.getMonth(), ny.getDate());

  const openNY = new Date(dayStart);
  openNY.setHours(MERIDIAN_CONFIG.MARKET_OPEN_HOUR, MERIDIAN_CONFIG.MARKET_OPEN_MINUTE, 0, 0);

  const closeNY = new Date(dayStart);
  closeNY.setHours(MERIDIAN_CONFIG.MARKET_CLOSE_HOUR, MERIDIAN_CONFIG.MARKET_CLOSE_MINUTE, 0, 0);

  const settleEndNY = new Date(dayStart);
  settleEndNY.setHours(16, 10, 0, 0);

  return {
    open: fromZonedTime(openNY, NY_TZ),
    close: fromZonedTime(closeNY, NY_TZ),
    settleEnd: fromZonedTime(settleEndNY, NY_TZ),
  };
}

function getNextOpenDate(now: Date): Date {
  const tomorrow = addDays(now, 1);
  const nextDay = getNextTradingDay(tomorrow);
  const ny = toZonedTime(nextDay, NY_TZ);
  const dayStart = new Date(ny.getFullYear(), ny.getMonth(), ny.getDate());
  dayStart.setHours(MERIDIAN_CONFIG.MARKET_OPEN_HOUR, MERIDIAN_CONFIG.MARKET_OPEN_MINUTE, 0, 0);
  return fromZonedTime(dayStart, NY_TZ);
}

function computeState(now: Date): SettlementTimerState {
  const isTradingDay = isNYSETradingDay(now);

  if (!isTradingDay) {
    const nextOpen = getNextOpenDate(now);
    return {
      timeString: `Market Closed. Next open: ${nextOpen.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} 9:30 AM ET`,
      status: 'closed',
      nextOpen,
    };
  }

  const { open, close, settleEnd } = getMarketTimes(now);

  if (now < open) {
    return {
      timeString: `Market opens in ${formatCountdown(open.getTime() - now.getTime())}`,
      status: 'closed',
      nextOpen: open,
    };
  }

  if (now >= open && now < close) {
    const remaining = close.getTime() - now.getTime();
    return {
      timeString: `Settlement in ${formatCountdown(remaining)}`,
      status: 'trading',
      nextOpen: null,
    };
  }

  if (now >= close && now < settleEnd) {
    return {
      timeString: 'Settlement in progress...',
      status: 'settling',
      nextOpen: null,
    };
  }

  const nextOpen = getNextOpenDate(now);
  return {
    timeString: `Market Closed. Next open: ${nextOpen.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} 9:30 AM ET`,
    status: 'closed',
    nextOpen,
  };
}

export function useSettlementTimer(): SettlementTimerState {
  const [state, setState] = useState<SettlementTimerState>(() =>
    computeState(new Date()),
  );

  const tick = useCallback(() => {
    setState(computeState(new Date()));
  }, []);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  return state;
}
