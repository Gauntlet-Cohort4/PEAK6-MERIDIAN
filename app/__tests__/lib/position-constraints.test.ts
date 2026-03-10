import { describe, it, expect } from 'vitest';
import {
  getAvailableTrades,
  isTradeSideAllowed,
} from '../../src/lib/position-constraints';
import { TradeSide } from '@meridian/shared/types';
import type { Position } from '@meridian/shared/types';

const makePosition = (
  yesBalance: number,
  noBalance: number,
): Position => ({
  marketAddress: 'test',
  ticker: 'AAPL',
  strikePrice: 230,
  yesTokenBalance: yesBalance,
  noTokenBalance: noBalance,
  avgEntryPrice: 0.5,
  unrealizedPnl: 0,
});

describe('getAvailableTrades', () => {
  it('allows Buy Yes and Buy No with no position', () => {
    const result = getAvailableTrades(null);
    expect(result.availableSides).toContain(TradeSide.BUY_YES);
    expect(result.availableSides).toContain(TradeSide.BUY_NO);
    expect(result.holdingYes).toBe(false);
    expect(result.holdingNo).toBe(false);
  });

  it('allows Buy Yes and Sell Yes when holding Yes', () => {
    const result = getAvailableTrades(makePosition(10, 0));
    expect(result.availableSides).toContain(TradeSide.BUY_YES);
    expect(result.availableSides).toContain(TradeSide.SELL_YES);
    expect(result.availableSides).not.toContain(TradeSide.BUY_NO);
    expect(result.holdingYes).toBe(true);
  });

  it('allows Buy No and Sell No when holding No', () => {
    const result = getAvailableTrades(makePosition(0, 10));
    expect(result.availableSides).toContain(TradeSide.BUY_NO);
    expect(result.availableSides).toContain(TradeSide.SELL_NO);
    expect(result.availableSides).not.toContain(TradeSide.BUY_YES);
    expect(result.holdingNo).toBe(true);
  });

  it('allows Buy Yes and Buy No when position has zero balances', () => {
    const result = getAvailableTrades(makePosition(0, 0));
    expect(result.availableSides).toContain(TradeSide.BUY_YES);
    expect(result.availableSides).toContain(TradeSide.BUY_NO);
  });
});

describe('isTradeSideAllowed', () => {
  it('returns true for allowed side', () => {
    expect(isTradeSideAllowed(TradeSide.BUY_YES, null)).toBe(true);
  });

  it('returns false for disallowed side', () => {
    expect(isTradeSideAllowed(TradeSide.BUY_NO, makePosition(10, 0))).toBe(false);
  });
});
