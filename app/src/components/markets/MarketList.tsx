'use client';

import { useState, useMemo } from 'react';
import { type StrikeMarket, type OrderBookState, MarketStatus } from '@meridian/shared/types';
import type { SupportedTicker } from '@meridian/shared/constants';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { usePositions } from '@/hooks/usePositions';
import { TickerFilter } from './TickerFilter';
import { StrikeTable } from './StrikeTable';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { SparklineChart } from '@/components/charts/SparklineChart';
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
 * Sparkline chart wrapper that fetches price history for a ticker.
 * Rendered once per expanded group (not per strike).
 */
function TickerSparkline({ ticker }: { readonly ticker: SupportedTicker }) {
  const { prices } = usePriceHistory(ticker);

  if (!prices || prices.length < 2) {
    return null;
  }

  return (
    <div className="px-3 pt-2 pb-1">
      <SparklineChart data={prices} height={48} showLastDot />
    </div>
  );
}

/**
 * A stock group card that shows ticker, live price, active contract count,
 * and expands to show a single sparkline + compact strike table.
 */
function StockGroup({
  group,
  orderBooks,
  defaultExpanded,
  getPosition,
}: {
  readonly group: TickerGroup;
  readonly orderBooks: Record<string, OrderBookState>;
  readonly defaultExpanded: boolean;
  readonly getPosition: (marketAddress: string) => import('@meridian/shared/types').Position | null;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const openCount = group.markets.filter(
    (m) => m.status === MarketStatus.OPEN,
  ).length;
  const totalCount = group.markets.length;

  return (
    <div className="space-y-0" data-testid={`stock-group-${group.ticker}`}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`w-full flex items-center justify-between border border-[#1e2a3a] bg-[#111827] px-4 py-3 hover:bg-[#1a2035] transition-colors cursor-pointer ${
          expanded ? 'rounded-t-md border-b-0' : 'rounded-md'
        }`}
        data-testid={`stock-group-header-${group.ticker}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-[#e2e8f0]">{group.ticker}</span>
          <PriceDisplay ticker={group.ticker} className="text-sm font-mono" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">
            {totalCount} contract{totalCount !== 1 ? 's' : ''}
            {openCount > 0 && (
              <span className="text-[#00d26a] ml-1">{openCount} active</span>
            )}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[#64748b]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#64748b]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="rounded-b-md border border-[#1e2a3a] border-t-0 bg-[#111827]">
          <TickerSparkline ticker={group.ticker} />
          <StrikeTable
            markets={group.markets}
            orderBooks={orderBooks}
            getPosition={getPosition}
          />
        </div>
      )}
    </div>
  );
}

export function MarketList({ markets, orderBooks }: MarketListProps) {
  const { getPosition } = usePositions();
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
              getPosition={getPosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}
