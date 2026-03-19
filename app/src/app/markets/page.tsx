'use client';

import { useState, useMemo } from 'react';
import { MarketList } from '@/components/markets/MarketList';
import { useMarkets } from '@/hooks/useMarkets';
import { useOrderBooks } from '@/hooks/useOrderBooks';
import { MarketStatus } from '@meridian/shared/types';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function MarketsPage() {
  const { markets: allMarkets, isLoading: marketsLoading, error: marketsError } = useMarkets();
  const [showClosed, setShowClosed] = useState(false);

  const markets = useMemo(() => {
    if (showClosed) return allMarkets;
    return allMarkets.filter(
      (m) => m.status === MarketStatus.OPEN || m.status === MarketStatus.PENDING,
    );
  }, [allMarkets, showClosed]);

  const closedCount = useMemo(
    () => allMarkets.filter(
      (m) => m.status === MarketStatus.CLOSED || m.status === MarketStatus.SETTLED,
    ).length,
    [allMarkets],
  );

  const marketAddresses = useMemo(
    () => markets.map((m) => m.address),
    [markets],
  );

  const { orderBooks, isLoading: booksLoading } = useOrderBooks(marketAddresses);

  const isLoading = marketsLoading || booksLoading;
  const error = marketsError;

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#e2e8f0]">Markets</h1>
            {!isLoading && markets.length > 0 && (
              <span className="bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-semibold px-2 py-0.5 rounded-full">
                {markets.length}
              </span>
            )}
          </div>
          {!isLoading && closedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowClosed((prev) => !prev)}
              className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
            >
              {showClosed ? 'Hide' : 'Show'} closed/settled ({closedCount})
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <p className="text-center text-[#ff3b69] py-8">
            Failed to load markets: {error}
          </p>
        ) : markets.length === 0 ? (
          <p className="text-center text-[#64748b] py-8">
            No markets available yet. Check back during trading hours.
          </p>
        ) : (
          <MarketList markets={markets} orderBooks={orderBooks} />
        )}
      </div>
    </ErrorBoundary>
  );
}
