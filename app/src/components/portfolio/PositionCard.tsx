'use client';

import { memo } from 'react';
import { MarketStatus, TradeSide } from '@meridian/shared/types';
import type { Position, StrikeMarket } from '@meridian/shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatUSD, formatPrice } from '@/lib/format';
import { cn } from '@/lib/cn';
import Link from 'next/link';

/**
 * Determine if a position's tokens are winners based on settlement.
 * Returns: 'yes_wins' | 'no_wins' | null (if not settled)
 */
function getSettlementOutcome(
  market: StrikeMarket | undefined,
): 'yes_wins' | 'no_wins' | null {
  if (
    !market ||
    market.status !== MarketStatus.SETTLED ||
    market.settlementPrice === null
  ) {
    return null;
  }
  return market.settlementPrice >= market.strikePrice ? 'yes_wins' : 'no_wins';
}

/**
 * Check if the user holds winning tokens for a settled market.
 */
function isWinningPosition(
  pos: Position,
  outcome: 'yes_wins' | 'no_wins',
): boolean {
  if (outcome === 'yes_wins') return pos.yesTokenBalance > 0;
  return pos.noTokenBalance > 0;
}

function getWinningAmount(
  pos: Position,
  outcome: 'yes_wins' | 'no_wins',
): number {
  if (outcome === 'yes_wins') return pos.yesTokenBalance;
  return pos.noTokenBalance;
}

function getRedeemSide(outcome: 'yes_wins' | 'no_wins'): TradeSide {
  return outcome === 'yes_wins' ? TradeSide.REDEEM_YES : TradeSide.REDEEM_NO;
}

export interface PositionCardProps {
  readonly pos: Position;
  readonly market: StrikeMarket | undefined;
  readonly onRedeem?: (
    marketAddress: string,
    side: TradeSide,
    amount: number,
  ) => void;
  readonly isRedeeming?: boolean;
}

export const PositionCard = memo(function PositionCard({ pos, market, onRedeem, isRedeeming }: PositionCardProps) {
  const isYes = pos.yesTokenBalance > 0;
  const quantity = isYes ? pos.yesTokenBalance : pos.noTokenBalance;
  const outcome = getSettlementOutcome(market);
  const isSettled = outcome !== null;
  const isWinner = outcome !== null && isWinningPosition(pos, outcome);
  const payout = isWinner ? getWinningAmount(pos, outcome) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{pos.ticker}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isYes ? 'yes' : 'no'}>
              {isYes ? 'Yes' : 'No'}
            </Badge>
            {isSettled && (
              <Badge variant={isWinner ? 'yes' : 'destructive'}>
                {isWinner ? 'Winner' : 'Lost'}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Strike: {formatUSD(pos.strikePrice)}
        </p>
        {isSettled &&
          market?.settlementPrice !== null &&
          market?.settlementPrice !== undefined && (
            <p className="text-sm text-muted-foreground">
              Settled at: {formatUSD(market.settlementPrice)}
            </p>
          )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Qty</span>
          <span className="font-mono">{quantity}</span>
        </div>
        {pos.avgEntryPrice > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg Entry</span>
            <span className="font-mono">{formatPrice(pos.avgEntryPrice)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg Entry</span>
            <span className="font-mono text-muted-foreground">N/A</span>
          </div>
        )}
        {isSettled ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payout</span>
            <span
              className={cn(
                'font-mono font-medium',
                isWinner ? 'text-yes' : 'text-no',
              )}
            >
              {isWinner ? formatUSD(payout) : '$0.00'}
            </span>
          </div>
        ) : (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="text-muted-foreground">Awaiting settlement</span>
          </div>
        )}

        {isSettled && isWinner && onRedeem && outcome !== null ? (
          <Button
            variant="yes"
            size="sm"
            className="w-full mt-2"
            disabled={isRedeeming}
            onClick={() =>
              onRedeem(pos.marketAddress, getRedeemSide(outcome), payout)
            }
          >
            {isRedeeming ? 'Redeeming...' : `Redeem ${formatUSD(payout)} USDC`}
          </Button>
        ) : !isSettled ? (
          <Link href={`/trade/${pos.marketAddress}`}>
            <Button variant="outline" size="sm" className="w-full mt-2">
              Trade
            </Button>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
});
