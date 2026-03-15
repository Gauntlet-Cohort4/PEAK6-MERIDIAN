'use client';

import { useCallback, useState } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { useMarkets } from '@/hooks/useMarkets';
import { useTradeActions } from '@/hooks/useTradeActions';
import { MarketStatus, TradeSide } from '@meridian/shared/types';
import type { Position, StrikeMarket } from '@meridian/shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
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

interface PositionCardProps {
  readonly pos: Position;
  readonly market: StrikeMarket | undefined;
  readonly onRedeem?: (
    marketAddress: string,
    side: TradeSide,
    amount: number,
  ) => void;
  readonly isRedeeming?: boolean;
}

function PositionCard({ pos, market, onRedeem, isRedeeming }: PositionCardProps) {
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
}

export default function PortfolioPage() {
  const { positions, isLoading: positionsLoading } = usePositions();
  const { markets, isLoading: marketsLoading } = useMarkets();
  const { submitOrder, isSubmitting } = useTradeActions();
  const [redeemingMarket, setRedeemingMarket] = useState<string | null>(null);

  const isLoading = positionsLoading || marketsLoading;

  // Cross-reference positions with markets (immutable map)
  const marketMap = new Map(markets.map((m) => [m.address, m]));

  // Split into active and settled
  const activePositions = positions.filter((p) => {
    const market = marketMap.get(p.marketAddress);
    return !market || market.status !== MarketStatus.SETTLED;
  });

  const settledPositions = positions.filter((p) => {
    const market = marketMap.get(p.marketAddress);
    return market?.status === MarketStatus.SETTLED;
  });

  const handleRedeem = useCallback(
    async (marketAddress: string, side: TradeSide, amount: number) => {
      setRedeemingMarket(marketAddress);
      try {
        await submitOrder({
          marketAddress,
          side,
          size: amount,
          price: 1.0,
          traderPublicKey: '', // Filled by useTradeActions from wallet
        });
      } catch (err) {
        console.error('Redeem failed:', err);
      } finally {
        setRedeemingMarket(null);
      }
    },
    [submitOrder],
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner size="lg" className="py-16" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">
          Your positions and redemptions
        </p>
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">No open positions</p>
          <Link href="/markets">
            <Button>Browse Markets</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Settled positions that can be redeemed */}
          {settledPositions.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Settled - Ready to Redeem
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settledPositions.map((pos) => (
                  <PositionCard
                    key={pos.marketAddress}
                    pos={pos}
                    market={marketMap.get(pos.marketAddress)}
                    onRedeem={handleRedeem}
                    isRedeeming={
                      isSubmitting && redeemingMarket === pos.marketAddress
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active positions */}
          {activePositions.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Active Positions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePositions.map((pos) => (
                  <PositionCard
                    key={pos.marketAddress}
                    pos={pos}
                    market={marketMap.get(pos.marketAddress)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
