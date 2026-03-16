import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DemoStateProvider, useDemoState } from '../../src/providers/DemoStateProvider';
import { MarketStatus } from '@meridian/shared/types';
import type { ReactNode } from 'react';

// Mock demo mode
vi.mock('../../src/lib/demo', () => ({
  IS_DEMO_MODE: true,
}));

function wrapper({ children }: { readonly children: ReactNode }) {
  return <DemoStateProvider>{children}</DemoStateProvider>;
}

describe('DemoStateProvider', () => {
  describe('Initial state', () => {
    it('provides markets from mock data', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      expect(result.current.state.markets.length).toBeGreaterThan(0);
      expect(result.current.isDemoMode).toBe(true);
    });

    it('provides positions from mock data', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      expect(result.current.state.positions.length).toBeGreaterThan(0);
    });

    it('provides prices from mock data', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      expect(Object.keys(result.current.state.prices).length).toBeGreaterThan(0);
      expect(result.current.state.prices['AAPL']).toBeDefined();
    });

    it('includes AAPL market at strike 230', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const aaplMarket = result.current.state.markets.find(
        (m) => m.ticker === 'AAPL' && m.strikePrice === 230,
      );
      expect(aaplMarket).toBeDefined();
      expect(aaplMarket!.status).toBe(MarketStatus.OPEN);
    });

    it('includes settled AAPL market at strike 225', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const settled = result.current.state.markets.find(
        (m) => m.ticker === 'AAPL' && m.strikePrice === 225,
      );
      expect(settled).toBeDefined();
      expect(settled!.status).toBe(MarketStatus.SETTLED);
      expect(settled!.settlementPrice).toBe(228.5);
    });
  });

  describe('settleMarket', () => {
    it('settles an open market with a settlement price', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const market = result.current.state.markets.find(
        (m) => m.ticker === 'AAPL' && m.status === MarketStatus.OPEN,
      )!;

      act(() => {
        result.current.actions.settleMarket(market.address, 235);
      });

      const updated = result.current.state.markets.find(
        (m) => m.address === market.address,
      )!;
      expect(updated.status).toBe(MarketStatus.SETTLED);
      expect(updated.settlementPrice).toBe(235);
      expect(updated.settledAt).toBeDefined();
    });

    it('ignores invalid settlement prices', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const market = result.current.state.markets.find(
        (m) => m.status === MarketStatus.OPEN,
      )!;

      act(() => {
        result.current.actions.settleMarket(market.address, -1);
      });

      const updated = result.current.state.markets.find(
        (m) => m.address === market.address,
      )!;
      expect(updated.status).toBe(MarketStatus.OPEN);
    });

    it('ignores Infinity settlement price', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const market = result.current.state.markets.find(
        (m) => m.status === MarketStatus.OPEN,
      )!;

      act(() => {
        result.current.actions.settleMarket(market.address, Infinity);
      });

      const updated = result.current.state.markets.find(
        (m) => m.address === market.address,
      )!;
      expect(updated.status).toBe(MarketStatus.OPEN);
    });
  });

  describe('reopenMarket', () => {
    it('reopens a settled market', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const settled = result.current.state.markets.find(
        (m) => m.status === MarketStatus.SETTLED,
      )!;

      act(() => {
        result.current.actions.reopenMarket(settled.address);
      });

      const updated = result.current.state.markets.find(
        (m) => m.address === settled.address,
      )!;
      expect(updated.status).toBe(MarketStatus.OPEN);
      expect(updated.settlementPrice).toBeNull();
      expect(updated.settledAt).toBeNull();
    });
  });

  describe('addPosition', () => {
    it('adds a new Yes position', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      // Find a market with no existing position
      const tslaMarket = result.current.state.markets.find(
        (m) => m.ticker === 'TSLA',
      )!;

      act(() => {
        result.current.actions.addPosition(tslaMarket.address, 5, 0);
      });

      const pos = result.current.state.positions.find(
        (p) => p.marketAddress === tslaMarket.address,
      );
      expect(pos).toBeDefined();
      expect(pos!.yesTokenBalance).toBe(5);
      expect(pos!.noTokenBalance).toBe(0);
      expect(pos!.ticker).toBe('TSLA');
    });

    it('adds to existing position', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      // AAPL 230 already has a position with yesTokenBalance=25
      const aaplPos = result.current.state.positions.find(
        (p) => p.ticker === 'AAPL' && p.strikePrice === 230,
      )!;
      const initialYes = aaplPos.yesTokenBalance;

      act(() => {
        result.current.actions.addPosition(aaplPos.marketAddress, 5, 0);
      });

      const updated = result.current.state.positions.find(
        (p) => p.marketAddress === aaplPos.marketAddress,
      )!;
      expect(updated.yesTokenBalance).toBe(initialYes + 5);
    });

    it('ignores add for non-existent market', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const countBefore = result.current.state.positions.length;

      act(() => {
        result.current.actions.addPosition('non-existent-market', 5, 0);
      });

      expect(result.current.state.positions.length).toBe(countBefore);
    });
  });

  describe('redeemPosition', () => {
    it('removes Yes tokens on redemption', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      // Settled AAPL 225 has yesTokenBalance=10
      const settledPos = result.current.state.positions.find(
        (p) => p.ticker === 'AAPL' && p.strikePrice === 225,
      )!;

      act(() => {
        result.current.actions.redeemPosition(
          settledPos.marketAddress,
          true, // isYes
          settledPos.yesTokenBalance,
        );
      });

      // Position should be removed (balance drops to 0)
      const remaining = result.current.state.positions.find(
        (p) => p.marketAddress === settledPos.marketAddress,
      );
      expect(remaining).toBeUndefined();
    });

    it('partially redeems a position', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      const settledPos = result.current.state.positions.find(
        (p) => p.ticker === 'AAPL' && p.strikePrice === 225,
      )!;

      act(() => {
        result.current.actions.redeemPosition(
          settledPos.marketAddress,
          true,
          5, // Redeem only 5 out of 10
        );
      });

      const updated = result.current.state.positions.find(
        (p) => p.marketAddress === settledPos.marketAddress,
      );
      expect(updated).toBeDefined();
      expect(updated!.yesTokenBalance).toBe(5);
    });

    it('redeems No tokens', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      // NVDA has noTokenBalance=15
      const nvdaPos = result.current.state.positions.find(
        (p) => p.ticker === 'NVDA',
      )!;

      act(() => {
        result.current.actions.redeemPosition(
          nvdaPos.marketAddress,
          false, // isNo
          nvdaPos.noTokenBalance,
        );
      });

      const remaining = result.current.state.positions.find(
        (p) => p.marketAddress === nvdaPos.marketAddress,
      );
      expect(remaining).toBeUndefined();
    });
  });

  describe('resetAll', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useDemoState(), { wrapper });

      // Modify state first
      const market = result.current.state.markets.find(
        (m) => m.status === MarketStatus.OPEN,
      )!;
      act(() => {
        result.current.actions.settleMarket(market.address, 235);
      });

      // Now reset
      act(() => {
        result.current.actions.resetAll();
      });

      const resetMarket = result.current.state.markets.find(
        (m) => m.address === market.address,
      )!;
      expect(resetMarket.status).toBe(MarketStatus.OPEN);
    });
  });

  describe('useDemoState fallback (no provider)', () => {
    it('returns no-op fallback when used outside provider', () => {
      const { result } = renderHook(() => useDemoState());

      expect(result.current.isDemoMode).toBe(false);
      expect(result.current.state.markets).toHaveLength(0);
      expect(result.current.state.positions).toHaveLength(0);
      // Actions should be no-ops (not throw)
      expect(() => result.current.actions.settleMarket('x', 100)).not.toThrow();
      expect(() => result.current.actions.resetAll()).not.toThrow();
    });
  });
});
