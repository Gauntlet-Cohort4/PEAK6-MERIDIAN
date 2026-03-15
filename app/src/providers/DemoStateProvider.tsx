'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { MarketStatus } from '@meridian/shared/types';
import type { StrikeMarket, Position } from '@meridian/shared/types';
import { MOCK_MARKETS, MOCK_POSITIONS, MOCK_PRICES } from '@/lib/mock-data';
import type { PriceData } from '@meridian/shared/types';

const IS_DEMO_MODE =
  typeof process !== 'undefined' &&
  process.env?.['NEXT_PUBLIC_DEMO_MODE'] === 'true';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoState {
  readonly markets: readonly StrikeMarket[];
  readonly positions: readonly Position[];
  readonly prices: Readonly<Record<string, PriceData>>;
}

interface DemoActions {
  /** Force-settle a market with a given settlement price. */
  readonly settleMarket: (
    marketAddress: string,
    settlementPrice: number,
    yesWins: boolean,
  ) => void;
  /** Reopen a settled market (undo settle for re-testing). */
  readonly reopenMarket: (marketAddress: string) => void;
  /** Add a position for the user on a market. */
  readonly addPosition: (
    marketAddress: string,
    yesTokens: number,
    noTokens: number,
  ) => void;
  /** Redeem a winning position (remove tokens, mark as redeemed). */
  readonly redeemPosition: (
    marketAddress: string,
    isYes: boolean,
    amount: number,
  ) => void;
  /** Reset all demo state to initial values. */
  readonly resetAll: () => void;
}

interface DemoContextValue {
  readonly isDemoMode: boolean;
  readonly state: DemoState;
  readonly actions: DemoActions;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DemoContext = createContext<DemoContextValue | null>(null);

function initialState(): DemoState {
  return {
    markets: [...MOCK_MARKETS],
    positions: [...MOCK_POSITIONS],
    prices: { ...MOCK_PRICES },
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DemoStateProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<DemoState>(initialState);

  const settleMarket = useCallback(
    (marketAddress: string, settlementPrice: number, yesWins: boolean) => {
      setState((prev) => ({
        ...prev,
        markets: prev.markets.map((m) =>
          m.address === marketAddress
            ? {
                ...m,
                status: MarketStatus.SETTLED,
                settlementPrice,
                settledAt: Date.now(),
              }
            : m,
        ),
      }));
    },
    [],
  );

  const reopenMarket = useCallback((marketAddress: string) => {
    setState((prev) => ({
      ...prev,
      markets: prev.markets.map((m) =>
        m.address === marketAddress
          ? {
              ...m,
              status: MarketStatus.OPEN,
              settlementPrice: null,
              settledAt: null,
            }
          : m,
      ),
    }));
  }, []);

  const addPosition = useCallback(
    (marketAddress: string, yesTokens: number, noTokens: number) => {
      setState((prev) => {
        const market = prev.markets.find((m) => m.address === marketAddress);
        if (!market) return prev;

        const existing = prev.positions.find(
          (p) => p.marketAddress === marketAddress,
        );
        if (existing) {
          return {
            ...prev,
            positions: prev.positions.map((p) =>
              p.marketAddress === marketAddress
                ? {
                    ...p,
                    yesTokenBalance: p.yesTokenBalance + yesTokens,
                    noTokenBalance: p.noTokenBalance + noTokens,
                  }
                : p,
            ),
          };
        }

        return {
          ...prev,
          positions: [
            ...prev.positions,
            {
              marketAddress,
              ticker: market.ticker,
              strikePrice: market.strikePrice,
              yesTokenBalance: yesTokens,
              noTokenBalance: noTokens,
              avgEntryPrice: 0.5,
              unrealizedPnl: 0,
            },
          ],
        };
      });
    },
    [],
  );

  const redeemPosition = useCallback(
    (marketAddress: string, isYes: boolean, amount: number) => {
      setState((prev) => ({
        ...prev,
        positions: prev.positions
          .map((p) => {
            if (p.marketAddress !== marketAddress) return p;
            return {
              ...p,
              yesTokenBalance: isYes
                ? Math.max(0, p.yesTokenBalance - amount)
                : p.yesTokenBalance,
              noTokenBalance: isYes
                ? p.noTokenBalance
                : Math.max(0, p.noTokenBalance - amount),
            };
          })
          .filter(
            (p) => p.yesTokenBalance > 0 || p.noTokenBalance > 0,
          ),
      }));
    },
    [],
  );

  const resetAll = useCallback(() => {
    setState(initialState());
  }, []);

  const actions: DemoActions = {
    settleMarket,
    reopenMarket,
    addPosition,
    redeemPosition,
    resetAll,
  };

  const value: DemoContextValue = {
    isDemoMode: IS_DEMO_MODE,
    state,
    actions,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDemoState(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    // Return a no-op fallback for non-demo mode
    return {
      isDemoMode: false,
      state: { markets: [], positions: [], prices: {} },
      actions: {
        settleMarket: () => {},
        reopenMarket: () => {},
        addPosition: () => {},
        redeemPosition: () => {},
        resetAll: () => {},
      },
    };
  }
  return ctx;
}
