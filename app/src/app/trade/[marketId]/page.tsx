'use client';

import { use, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { SupportedTicker } from '@meridian/shared/constants';

const PriceChart = dynamic(() => import('@/components/charts/PriceChart'), { ssr: false });
import { useMarkets } from '@/hooks/useMarkets';
import { useOrderBooks } from '@/hooks/useOrderBooks';
import { usePositions } from '@/hooks/usePositions';
import { OrderBook } from '@/components/trade/OrderBook';
import { TradePanel } from '@/components/trade/TradePanel';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { Badge } from '@/components/ui/badge';
import { MarketStatus } from '@meridian/shared/types';
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
          <p className="text-center text-[#64748b]">Market not found</p>
        </div>
      ) : (
      <div className="container mx-auto px-4 py-4">
        {/* Header row: inline horizontal layout */}
        <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-[#1e2a3a]">
          <h1 className="text-xl font-bold text-[#e2e8f0]">{market.ticker}</h1>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#1e2a3a] text-[#64748b]">
            {market.status}
          </Badge>
          <span className="text-xs text-[#64748b]">
            Strike: <span className="font-mono text-[#e2e8f0]">{formatUSD(market.strikePrice)}</span>
          </span>
          <span className="text-xs text-[#64748b]">
            Live: <PriceDisplay ticker={market.ticker} className="font-mono text-[#e2e8f0]" />
          </span>
          <SettlementTimer />
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Price chart */}
            <PriceChart ticker={market.ticker as SupportedTicker} strikePrice={market.strikePrice} height={350} />

            {market.status === MarketStatus.SETTLED ? (
              <div className="rounded-md border border-[#1e2a3a] bg-[#111827] p-6 text-center">
                <p className="text-[#64748b] text-sm">
                  Order book is closed. This market has been settled.
                </p>
              </div>
            ) : orderBook ? (
              <>
                <OrderBook orderBookData={orderBook} perspective="yes" />
                <OrderBook orderBookData={orderBook} perspective="no" />
              </>
            ) : (
              <p className="text-center text-[#64748b] py-8 text-sm">
                No order book data available
              </p>
            )}
          </div>

          <div className="space-y-4">
            {market.status === MarketStatus.SETTLED ? (
              <div className="rounded-md border border-[#1e2a3a] bg-[#111827] p-4 text-center space-y-2">
                <Badge variant="outline" className="text-sm px-3 py-0.5 border-[#1e2a3a] text-[#e2e8f0]">
                  Market Settled
                </Badge>
                {market.settlementPrice !== null && (
                  <p className="text-xs text-[#64748b]">
                    Settlement price: <span className="font-mono text-[#e2e8f0]">{formatUSD(market.settlementPrice)}</span>
                  </p>
                )}
                <p className="text-xs text-[#64748b]">
                  {market.settlementPrice !== null &&
                  market.settlementPrice >= market.strikePrice
                    ? 'YES wins - price closed at or above the strike'
                    : 'NO wins - price closed below the strike'}
                </p>
                <p className="text-[10px] text-[#64748b]">
                  Visit your portfolio to redeem winning positions.
                </p>
              </div>
            ) : positionsLoading ? (
              <LoadingSpinner />
            ) : (
              <TradePanel
                market={market}
                position={position}
                defaultPrice={orderBook?.asks[0]?.price ?? 0.5}
              />
            )}
            <DemoMarketControls market={market} orderBook={orderBook} position={position} />
          </div>
        </div>
      </div>
      )}
    </ErrorBoundary>
  );
}
