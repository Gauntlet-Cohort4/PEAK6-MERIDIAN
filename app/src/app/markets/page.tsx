'use client';

import { useMemo } from 'react';
import { MarketList } from '@/components/markets/MarketList';
import { useMarkets } from '@/hooks/useMarkets';
import { useOrderBooks } from '@/hooks/useOrderBooks';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

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
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Markets</h1>
        <p className="text-muted-foreground">
          Browse active binary option contracts. Click a market to trade.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="text-center text-destructive py-8">
          Failed to load markets: {error}
        </p>
      ) : markets.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No markets available yet. Check back during trading hours.
        </p>
      ) : (
        <MarketList markets={markets} orderBooks={orderBooks} />
      )}
    </div>
  );
}
