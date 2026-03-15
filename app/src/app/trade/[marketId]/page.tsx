'use client';

import { use, useMemo } from 'react';
import { useMarkets } from '@/hooks/useMarkets';
import { useOrderBooks } from '@/hooks/useOrderBooks';
import { usePositions } from '@/hooks/usePositions';
import { OrderBook } from '@/components/trade/OrderBook';
import { TradePanel } from '@/components/trade/TradePanel';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { Badge } from '@/components/ui/badge';
import { formatUSD } from '@/lib/format';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { SettlementTimer } from '@/components/shared/SettlementTimer';
import { DemoMarketControls } from '@/components/shared/DemoControls';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

interface TradePageProps {
  readonly params: Promise<{ readonly marketId: string }>;
}

export default function TradePage({ params }: TradePageProps) {
  const { marketId } = use(params);
  const { markets, isLoading: marketsLoading } = useMarkets();
  const { getPosition, isLoading: positionsLoading } = usePositions();

  const market = useMemo(
    () => markets.find((m) => m.address === marketId) ?? null,
    [markets, marketId],
  );

  const marketAddresses = useMemo(
    () => (market ? [market.address] : []),
    [market],
  );

  const { orderBooks } = useOrderBooks(marketAddresses);
  const orderBook = orderBooks[marketId] ?? null;

  const position = market ? getPosition(market.address) : null;

  return (
    <ErrorBoundary>
      {marketsLoading ? (
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : !market ? (
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Market not found</p>
        </div>
      ) : (
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
            <SettlementTimer />
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

          <div className="space-y-4">
            {positionsLoading ? (
              <LoadingSpinner />
            ) : (
              <TradePanel
                market={market}
                position={position}
                defaultPrice={orderBook?.asks[0]?.price ?? 0.5}
              />
            )}
            <DemoMarketControls market={market} />
          </div>
        </div>
      </div>
      )}
    </ErrorBoundary>
  );
}
