'use client';

import { useCallback, useState } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { useMarkets } from '@/hooks/useMarkets';
import { useTradeActions } from '@/hooks/useTradeActions';
import { MarketStatus, TradeSide } from '@meridian/shared/types';
import { useDemoState } from '@/providers/DemoStateProvider';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PositionCard } from '@/components/portfolio/PositionCard';
import Link from 'next/link';

export default function PortfolioPage() {
  const { positions, isLoading: positionsLoading } = usePositions();
  const { markets, isLoading: marketsLoading } = useMarkets();
  const { submitOrder, isSubmitting } = useTradeActions();
  const { actions: demoActions, isDemoMode } = useDemoState();
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
          traderPublicKey: '',
        });
        // In demo mode, update local state to remove redeemed position
        if (isDemoMode) {
          const isYes = side === TradeSide.REDEEM_YES;
          demoActions.redeemPosition(marketAddress, isYes, amount);
        }
      } catch (err) {
        console.error('Redeem failed:', err);
      } finally {
        setRedeemingMarket(null);
      }
    },
    [submitOrder],
  );

  return (
    <ErrorBoundary>
      {isLoading ? (
        <div className="container mx-auto px-4 py-8">
          <LoadingSpinner size="lg" className="py-16" />
        </div>
      ) : (
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
      )}
    </ErrorBoundary>
  );
}
