'use client';

import { useState, useMemo } from 'react';
import { type StrikeMarket, type OrderBookState, MarketStatus } from '@meridian/shared/types';
import type { SupportedTicker } from '@meridian/shared/constants';
import { usePythPrice } from '@/hooks/usePythPrice';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { MarketCard } from './MarketCard';
import { TickerFilter } from './TickerFilter';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface MarketListProps {
  readonly markets: readonly StrikeMarket[];
  readonly orderBooks: Record<string, OrderBookState>;
}

interface TickerGroup {
  readonly ticker: SupportedTicker;
  readonly markets: readonly StrikeMarket[];
}

/**
 * Wrapper that calls usePythPrice for a single market card,
 * keeping MarketCard pure and testable.
 */
function LiveMarketCard({
  market,
  orderBook,
}: {
  readonly market: StrikeMarket;
  readonly orderBook: OrderBookState | null;
}) {
  const { priceData } = usePythPrice(market.ticker);
  const { prices: priceHistory } = usePriceHistory(market.ticker as SupportedTicker);
  return (
    <MarketCard
      market={market}
      orderBook={orderBook}
      currentStockPrice={priceData?.price ?? null}
      priceHistory={priceHistory}
    />
  );
}

/**
 * A stock group card that shows ticker, live price, active contract count,
 * and expands to show individual strike contracts.
 */
function StockGroup({
  group,
  orderBooks,
  defaultExpanded,
}: {
  readonly group: TickerGroup;
  readonly orderBooks: Record<string, OrderBookState>;
  readonly defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const openCount = group.markets.filter(
    (m) => m.status === MarketStatus.OPEN,
  ).length;
  const totalCount = group.markets.length;

  return (
    <div className="space-y-2" data-testid={`stock-group-${group.ticker}`}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between rounded-md border border-[#1e2a3a] bg-[#111827] px-4 py-3 hover:bg-[#1a2035] transition-colors cursor-pointer"
        data-testid={`stock-group-header-${group.ticker}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-[#e2e8f0]">{group.ticker}</span>
          <PriceDisplay ticker={group.ticker} className="text-sm font-mono" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">
            {openCount > 0 ? `${openCount} active` : `${totalCount} contracts`}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[#64748b]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#64748b]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-1">
          {group.markets.map((market) => (
            <LiveMarketCard
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

  const tickerGroups = useMemo(() => {
    const groupMap = new Map<SupportedTicker, StrikeMarket[]>();

    for (const market of filteredMarkets) {
      const ticker = market.ticker as SupportedTicker;
      const existing = groupMap.get(ticker);
      if (existing) {
        groupMap.set(ticker, [...existing, market]);
      } else {
        groupMap.set(ticker, [market]);
      }
    }

    const groups: readonly TickerGroup[] = Array.from(groupMap.entries()).map(
      ([ticker, tickerMarkets]) => ({
        ticker,
        markets: tickerMarkets,
      }),
    );

    return groups;
  }, [filteredMarkets]);

  // When a specific ticker is selected, expand it by default
  const isSingleTicker = selectedTicker !== null;

  return (
    <div className="space-y-4" data-testid="market-list">
      <TickerFilter selected={selectedTicker} onSelect={setSelectedTicker} />

      {tickerGroups.length === 0 ? (
        <p className="text-center text-[#64748b] py-8">
          No markets found
        </p>
      ) : (
        <div className="space-y-3">
          {tickerGroups.map((group) => (
            <StockGroup
              key={group.ticker}
              group={group}
              orderBooks={orderBooks}
              defaultExpanded={isSingleTicker}
            />
          ))}
        </div>
      )}
    </div>
  );
}
