'use client';

import { useMemo } from 'react';
import { MarketList } from '@/components/markets/MarketList';
import { useMarkets } from '@/hooks/useMarkets';
import { useOrderBooks } from '@/hooks/useOrderBooks';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function MarketsPage() {
  const { markets, isLoading: marketsLoading, error: marketsError } = useMarkets();

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
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-[#e2e8f0]">Markets</h1>
          {!isLoading && markets.length > 0 && (
            <span className="bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-semibold px-2 py-0.5 rounded-full">
              {markets.length}
            </span>
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
