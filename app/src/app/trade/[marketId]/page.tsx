'use client';

import { use, useMemo } from 'react';
import { MOCK_MARKETS, MOCK_ORDER_BOOKS } from '@/lib/mock-data';
import { usePositions } from '@/hooks/usePositions';
import { OrderBook } from '@/components/trade/OrderBook';
import { TradePanel } from '@/components/trade/TradePanel';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { Badge } from '@/components/ui/badge';
import { formatUSD } from '@/lib/format';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface TradePageProps {
  readonly params: Promise<{ readonly marketId: string }>;
}

export default function TradePage({ params }: TradePageProps) {
  const { marketId } = use(params);
  const { getPosition, isLoading: positionsLoading } = usePositions();

  const market = useMemo(
    () => MOCK_MARKETS.find((m) => m.address === marketId) ?? null,
    [marketId],
  );

  const orderBook = useMemo(
    () => MOCK_ORDER_BOOKS[marketId] ?? null,
    [marketId],
  );

  const position = market ? getPosition(market.address) : null;

  if (!market) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Market not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{market.ticker}</h1>
          <Badge variant="outline">{market.status}</Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Strike: {formatUSD(market.strikePrice)}</span>
          <span>
            Live: <PriceDisplay ticker={market.ticker} />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {orderBook ? (
            <>
              <OrderBook orderBookData={orderBook} perspective="yes" />
              <OrderBook orderBookData={orderBook} perspective="no" />
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No order book data available
            </p>
          )}
        </div>

        <div>
          {positionsLoading ? (
            <LoadingSpinner />
          ) : (
            <TradePanel
              market={market}
              position={position}
              defaultPrice={orderBook?.asks[0]?.price ?? 0.5}
            />
          )}
        </div>
      </div>
    </div>
  );
}
