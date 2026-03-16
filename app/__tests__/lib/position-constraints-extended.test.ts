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

describe('Position Constraint Enforcement - Cannot Hold Both Yes and No', () => {
  describe('No position (null)', () => {
    it('allows only BUY_YES and BUY_NO', () => {
      const result = getAvailableTrades(null);
      expect(result.availableSides).toContain(TradeSide.BUY_YES);
      expect(result.availableSides).toContain(TradeSide.BUY_NO);
      expect(result.availableSides).not.toContain(TradeSide.SELL_YES);
      expect(result.availableSides).not.toContain(TradeSide.SELL_NO);
    });

    it('reports no holdings', () => {
      const result = getAvailableTrades(null);
      expect(result.holdingYes).toBe(false);
      expect(result.holdingNo).toBe(false);
    });
  });

  describe('Holding Yes tokens only', () => {
    const yesPos = makePosition(10, 0);

    it('allows BUY_YES (add to position)', () => {
      expect(isTradeSideAllowed(TradeSide.BUY_YES, yesPos)).toBe(true);
    });

    it('allows SELL_YES (reduce position)', () => {
      expect(isTradeSideAllowed(TradeSide.SELL_YES, yesPos)).toBe(true);
    });

    it('blocks BUY_NO (would create opposite position)', () => {
      expect(isTradeSideAllowed(TradeSide.BUY_NO, yesPos)).toBe(false);
    });

    it('blocks SELL_NO (no No tokens to sell)', () => {
      expect(isTradeSideAllowed(TradeSide.SELL_NO, yesPos)).toBe(false);
    });

    it('reports holdingYes=true, holdingNo=false', () => {
      const result = getAvailableTrades(yesPos);
      expect(result.holdingYes).toBe(true);
      expect(result.holdingNo).toBe(false);
    });
  });

  describe('Holding No tokens only', () => {
    const noPos = makePosition(0, 15);

    it('blocks BUY_YES (would create opposite position)', () => {
      expect(isTradeSideAllowed(TradeSide.BUY_YES, noPos)).toBe(false);
    });

    it('blocks SELL_YES (no Yes tokens to sell)', () => {
      expect(isTradeSideAllowed(TradeSide.SELL_YES, noPos)).toBe(false);
    });

    it('allows BUY_NO (add to position)', () => {
      expect(isTradeSideAllowed(TradeSide.BUY_NO, noPos)).toBe(true);
    });

    it('allows SELL_NO (reduce position)', () => {
      expect(isTradeSideAllowed(TradeSide.SELL_NO, noPos)).toBe(true);
    });

    it('reports holdingYes=false, holdingNo=true', () => {
      const result = getAvailableTrades(noPos);
      expect(result.holdingYes).toBe(false);
      expect(result.holdingNo).toBe(true);
    });
  });

  describe('Flat position (zero balances)', () => {
    const flatPos = makePosition(0, 0);

    it('allows BUY_YES (entering fresh)', () => {
      expect(isTradeSideAllowed(TradeSide.BUY_YES, flatPos)).toBe(true);
    });

    it('allows BUY_NO (entering fresh)', () => {
      expect(isTradeSideAllowed(TradeSide.BUY_NO, flatPos)).toBe(true);
    });

    it('does not allow SELL_YES (nothing to sell)', () => {
      expect(isTradeSideAllowed(TradeSide.SELL_YES, flatPos)).toBe(false);
    });

    it('does not allow SELL_NO (nothing to sell)', () => {
      expect(isTradeSideAllowed(TradeSide.SELL_NO, flatPos)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('treats very small Yes balance as holding Yes', () => {
      const pos = makePosition(0.001, 0);
      expect(isTradeSideAllowed(TradeSide.BUY_NO, pos)).toBe(false);
      expect(isTradeSideAllowed(TradeSide.BUY_YES, pos)).toBe(true);
    });

    it('treats very small No balance as holding No', () => {
      const pos = makePosition(0, 0.001);
      expect(isTradeSideAllowed(TradeSide.BUY_YES, pos)).toBe(false);
      expect(isTradeSideAllowed(TradeSide.BUY_NO, pos)).toBe(true);
    });

    it('large Yes balance still blocks Buy No', () => {
      const pos = makePosition(1000, 0);
      expect(isTradeSideAllowed(TradeSide.BUY_NO, pos)).toBe(false);
    });

    it('getAvailableTrades returns exactly 2 sides for Yes holder', () => {
      const pos = makePosition(10, 0);
      const result = getAvailableTrades(pos);
      expect(result.availableSides).toHaveLength(2);
      expect(result.availableSides).toEqual([TradeSide.BUY_YES, TradeSide.SELL_YES]);
    });

    it('getAvailableTrades returns exactly 2 sides for No holder', () => {
      const pos = makePosition(0, 10);
      const result = getAvailableTrades(pos);
      expect(result.availableSides).toHaveLength(2);
      expect(result.availableSides).toEqual([TradeSide.BUY_NO, TradeSide.SELL_NO]);
    });

    it('getAvailableTrades returns exactly 2 sides for no position', () => {
      const result = getAvailableTrades(null);
      expect(result.availableSides).toHaveLength(2);
    });
  });
});
