'use client';

import { memo } from 'react';
import Link from 'next/link';
import type { StrikeMarket, OrderBookState } from '@meridian/shared/types';
import { Badge } from '@/components/ui/badge';
import { formatUSD, formatPercent, formatPrice } from '@/lib/format';
import { calcImpliedProbability, isOneSidedBook } from '@/lib/implied-probability';
import { cn } from '@/lib/cn';
import { SparklineChart } from '@/components/charts/SparklineChart';

interface MarketCardProps {
  readonly market: StrikeMarket;
  readonly orderBook: OrderBookState | null;
  readonly currentStockPrice?: number | null;
  readonly priceHistory?: readonly { time: number; value: number }[];
}

function getBestPrices(book: OrderBookState | null): {
  bestBid: number | null;
  bestAsk: number | null;
} {
  if (!book) {
    return { bestBid: null, bestAsk: null };
  }
  const bestBid = book.bids.length > 0 ? book.bids[0].price : null;
  const bestAsk = book.asks.length > 0 ? book.asks[0].price : null;
  return { bestBid, bestAsk };
}

export const MarketCard = memo(function MarketCard({ market, orderBook, currentStockPrice, priceHistory }: MarketCardProps) {
  const { bestBid, bestAsk } = getBestPrices(orderBook);
  const probability = calcImpliedProbability(bestBid, bestAsk);
  const oneSided = isOneSidedBook(bestBid, bestAsk);
  const yesPrice = probability;
  const noPrice = probability !== null ? 1 - probability : null;
  const probPercent = probability !== null ? Math.round(probability * 100) : 0;

  return (
    <Link href={`/trade/${market.address}`}>
      <div
        className={cn(
          'bg-[#111827] border border-[#1e2a3a] rounded-md p-3 cursor-pointer transition-colors hover:bg-[#1a2035]',
          'border-l-[3px]',
          probability !== null && probability >= 0.5 ? 'border-l-[#00d26a]' : 'border-l-[#ff3b69]',
        )}
        data-testid="market-card"
      >
        {/* Top row: ticker + status */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-[#e2e8f0]">{market.ticker}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#1e2a3a] text-[#64748b]">
            {market.status}
          </Badge>
        </div>

        {/* Middle: strike + current price */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-[#64748b]">
            Strike: <span className="font-mono text-[#e2e8f0]">{formatUSD(market.strikePrice)}</span>
          </span>
          <span className="text-[#64748b]">
            Current: <span className="font-mono text-[#e2e8f0]">
              {currentStockPrice != null ? formatUSD(currentStockPrice) : '\u2014'}
            </span>
          </span>
        </div>

        {/* YES/NO chips */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 bg-[#00d26a15] text-[#00d26a] text-xs font-mono font-semibold px-2 py-0.5 rounded">
            YES {yesPrice !== null ? formatPrice(yesPrice) : '\u2014'}
          </span>
          <span className="inline-flex items-center gap-1 bg-[#ff3b6915] text-[#ff3b69] text-xs font-mono font-semibold px-2 py-0.5 rounded">
            NO {noPrice !== null ? formatPrice(noPrice) : '\u2014'}
          </span>
          {oneSided && (
            <Badge variant="warning" data-testid="low-liquidity-badge" className="text-[10px] px-1.5 py-0">
              Low Liq
            </Badge>
          )}
        </div>

        {/* Probability mini bar */}
        {probability !== null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-[#1e2a3a] rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  probability >= 0.5 ? 'bg-[#00d26a]' : 'bg-[#ff3b69]',
                )}
                style={{ width: `${probPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-[#64748b]">
              {formatPercent(probability)}
            </span>
          </div>
        )}

        {/* Sparkline price history */}
        {priceHistory && priceHistory.length > 0 && (
          <div className="mt-2 -mx-1">
            <SparklineChart data={priceHistory} height={40} showLastDot />
          </div>
        )}
      </div>
    </Link>
  );
});
