'use client';

import { MarketList } from '@/components/markets/MarketList';
import { MOCK_MARKETS, MOCK_ORDER_BOOKS } from '@/lib/mock-data';

export default function MarketsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Markets</h1>
        <p className="text-muted-foreground">
          Browse active binary option contracts. Click a market to trade.
        </p>
      </div>
      <MarketList markets={MOCK_MARKETS} orderBooks={MOCK_ORDER_BOOKS} />
    </div>
  );
}
