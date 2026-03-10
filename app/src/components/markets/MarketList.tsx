'use client';

import { useState, useMemo } from 'react';
import type { StrikeMarket, OrderBookState } from '@meridian/shared/types';
import type { SupportedTicker } from '@meridian/shared/constants';
import { MarketCard } from './MarketCard';
import { TickerFilter } from './TickerFilter';

interface MarketListProps {
  readonly markets: readonly StrikeMarket[];
  readonly orderBooks: Record<string, OrderBookState>;
}

export function MarketList({ markets, orderBooks }: MarketListProps) {
  const [selectedTicker, setSelectedTicker] = useState<SupportedTicker | null>(
    null,
  );

  const filteredMarkets = useMemo(() => {
    if (selectedTicker === null) {
      return markets;
    }
    return markets.filter((m) => m.ticker === selectedTicker);
  }, [markets, selectedTicker]);

  return (
    <div className="space-y-6" data-testid="market-list">
      <TickerFilter selected={selectedTicker} onSelect={setSelectedTicker} />

      {filteredMarkets.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No markets found
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((market) => (
            <MarketCard
              key={market.address}
              market={market}
              orderBook={orderBooks[market.address] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
