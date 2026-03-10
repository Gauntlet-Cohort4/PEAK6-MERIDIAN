'use client';

import { TradeSide } from '@meridian/shared/types';
import { formatUSD } from '@/lib/format';
import { cn } from '@/lib/cn';

interface PayoffDisplayProps {
  readonly side: TradeSide;
  readonly size: number;
  readonly price: number;
  readonly ticker: string;
  readonly strikePrice: number;
}

function getPayoffDescription(
  side: TradeSide,
  ticker: string,
  strikePrice: number,
): string {
  const above = `${ticker} closes above $${strikePrice.toFixed(0)}`;
  const below = `${ticker} closes below $${strikePrice.toFixed(0)}`;

  switch (side) {
    case TradeSide.BUY_YES:
      return `You win $1.00 if ${above}.`;
    case TradeSide.BUY_NO:
      return `You win $1.00 if ${below}.`;
    case TradeSide.SELL_YES:
      return `You receive payment now. You owe $1.00 if ${above}.`;
    case TradeSide.SELL_NO:
      return `You receive payment now. You owe $1.00 if ${below}.`;
  }
}

function getCostLabel(side: TradeSide): string {
  return side === TradeSide.SELL_YES || side === TradeSide.SELL_NO
    ? 'You receive'
    : 'You pay';
}

export function PayoffDisplay({
  side,
  size,
  price,
  ticker,
  strikePrice,
}: PayoffDisplayProps) {
  const totalCost = size * price;
  const costLabel = getCostLabel(side);
  const description = getPayoffDescription(side, ticker, strikePrice);
  const isBuy = side === TradeSide.BUY_YES || side === TradeSide.BUY_NO;

  return (
    <div
      className="rounded-lg border bg-muted/50 p-4 space-y-2"
      data-testid="payoff-display"
    >
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{costLabel}</span>
        <span
          className={cn(
            'text-lg font-mono font-semibold',
            isBuy ? 'text-no' : 'text-yes',
          )}
        >
          {formatUSD(totalCost)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {isBuy && size > 0 && (
        <p className="text-xs text-muted-foreground">
          Max profit: {formatUSD(size - totalCost)} | Max loss: {formatUSD(totalCost)}
        </p>
      )}
    </div>
  );
}
