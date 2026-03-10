'use client';

import Link from 'next/link';
import type { StrikeMarket, OrderBookState } from '@meridian/shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUSD, formatPercent, formatPrice } from '@/lib/format';
import { calcImpliedProbability, isOneSidedBook } from '@/lib/implied-probability';
import { cn } from '@/lib/cn';

interface MarketCardProps {
  readonly market: StrikeMarket;
  readonly orderBook: OrderBookState | null;
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

export function MarketCard({ market, orderBook }: MarketCardProps) {
  const { bestBid, bestAsk } = getBestPrices(orderBook);
  const probability = calcImpliedProbability(bestBid, bestAsk);
  const oneSided = isOneSidedBook(bestBid, bestAsk);
  const yesPrice = probability;
  const noPrice = probability !== null ? 1 - probability : null;

  return (
    <Link href={`/trade/${market.address}`}>
      <Card
        className="hover:border-primary/50 transition-colors cursor-pointer"
        data-testid="market-card"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{market.ticker}</CardTitle>
            <Badge variant="outline">{market.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Strike: {formatUSD(market.strikePrice)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Yes</p>
              <p className={cn('text-lg font-mono font-semibold', 'text-yes')}>
                {yesPrice !== null ? formatPrice(yesPrice) : '\u2014'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">No</p>
              <p className={cn('text-lg font-mono font-semibold', 'text-no')}>
                {noPrice !== null ? formatPrice(noPrice) : '\u2014'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Implied Prob.</p>
              <p className="text-sm font-medium">
                {probability !== null ? formatPercent(probability) : '\u2014'}
              </p>
            </div>
            {oneSided && (
              <Badge variant="warning" data-testid="low-liquidity-badge">
                Low Liquidity
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
