'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { MarketStatus } from '@meridian/shared/types';
import type { StrikeMarket } from '@meridian/shared/types';
import type { SupportedTicker } from '@meridian/shared/constants';
import { PYTH_FEED_IDS } from '@meridian/shared/constants';
import { getMeridianProgram } from '@/lib/tx/program';
import { useDemoState } from '@/providers/DemoStateProvider';

/** Whether the app is running in demo mode (no real on-chain reads). */
const IS_DEMO_MODE =
  typeof process !== 'undefined' &&
  process.env?.['NEXT_PUBLIC_DEMO_MODE'] === 'true';

export interface UseMarketsResult {
  readonly markets: readonly StrikeMarket[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

/** Map on-chain strike_price (cents u64) to dollars. */
function centsToUsd(cents: BN | number): number {
  const val = typeof cents === 'number' ? cents : cents.toNumber();
  return val / 100;
}

/** Derive the MarketStatus from on-chain booleans and timestamps. */
function deriveMarketStatus(account: {
  readonly settled: boolean;
  readonly tradingDate: BN;
}): MarketStatus {
  if (account.settled) {
    return MarketStatus.SETTLED;
  }

  // trading_date is midnight ET — market closes at 16:00 ET (same day).
  // If current time > trading_date + 16h, market is CLOSED (awaiting settlement).
  const tradingDateMs = account.tradingDate.toNumber() * 1000;
  const closingMs = tradingDateMs + 16 * 3600 * 1000;
  const now = Date.now();

  if (now >= closingMs) {
    return MarketStatus.CLOSED;
  }

  const openingMs = tradingDateMs + 9.5 * 3600 * 1000;
  if (now < openingMs) {
    return MarketStatus.PENDING;
  }

  return MarketStatus.OPEN;
}

/** Look up the Pyth feed ID for a ticker, falling back to empty string. */
function feedIdForTicker(ticker: string): string {
  const id = PYTH_FEED_IDS[ticker as SupportedTicker];
  return id ?? '';
}

/**
 * Map a raw Anchor account to the frontend StrikeMarket shape.
 * `publicKey` is the on-chain address of the account.
 */
function mapOnChainToStrikeMarket(
  publicKey: PublicKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any,
): StrikeMarket {
  const settled: boolean = account.settled;
  const tradingDate: BN = account.tradingDate;
  const strikePriceCents: BN = account.strikePrice;
  const settlementPriceCents: BN = account.settlementPrice;
  const settledAtBN: BN = account.settledAt;
  const ticker: string = account.ticker;

  const tradingDateMs = tradingDate.toNumber() * 1000;
  // Expiry is NYSE close: trading_date + 16 hours
  const expiryTimestamp = tradingDateMs + 16 * 3600 * 1000;

  return {
    address: publicKey.toBase58(),
    ticker: ticker as SupportedTicker,
    strikePrice: centsToUsd(strikePriceCents),
    expiryTimestamp,
    status: deriveMarketStatus({ settled, tradingDate }),
    yesTokenMint: (account.yesMint as PublicKey).toBase58(),
    noTokenMint: (account.noMint as PublicKey).toBase58(),
    oracleFeedId: feedIdForTicker(ticker),
    settlementPrice: settled ? centsToUsd(settlementPriceCents) : null,
    createdAt: tradingDateMs,
    settledAt: settled && settledAtBN.toNumber() > 0
      ? settledAtBN.toNumber() * 1000
      : null,
  };
}

/**
 * Hook to fetch all StrikeMarket accounts from the Meridian program.
 *
 * When NEXT_PUBLIC_DEMO_MODE=true, returns MOCK_MARKETS.
 * When no markets exist on-chain, returns an empty array (not an error).
 */
export function useMarkets(): UseMarketsResult {
  const [markets, setMarkets] = useState<readonly StrikeMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const { state: demoState } = useDemoState();

  const refetch = useCallback(() => {
    setRefetchKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setMarkets(demoState.markets);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchMarkets() {
      setIsLoading(true);
      setError(null);

      try {
        const program = getMeridianProgram();
        // Anchor's .all() returns Array<{ publicKey, account }>
        const rawAccounts = await (program.account as any).strikeMarket.all();

        if (cancelled) return;

        const mapped: StrikeMarket[] = rawAccounts.map(
          (item: { publicKey: PublicKey; account: unknown }) =>
            mapOnChainToStrikeMarket(item.publicKey, item.account),
        );

        setMarkets(mapped);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to fetch markets';
        console.error('useMarkets: fetch failed', err);
        setError(message);
        // Return empty array on error rather than stale data
        setMarkets([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchMarkets();

    return () => {
      cancelled = true;
    };
  }, [refetchKey, demoState.markets]);

  return { markets, isLoading, error, refetch };
}
