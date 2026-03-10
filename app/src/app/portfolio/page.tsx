'use client';

import { usePositions } from '@/hooks/usePositions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { formatUSD, formatPrice } from '@/lib/format';
import { calculatePnl } from '@/lib/pnl';
import { cn } from '@/lib/cn';
import Link from 'next/link';

export default function PortfolioPage() {
  const { positions, isLoading } = usePositions();

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
        <p className="text-muted-foreground">Your open positions</p>
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">No open positions</p>
          <Link href="/markets">
            <Button>Browse Markets</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {positions.map((pos) => {
            const isYes = pos.yesTokenBalance > 0;
            const quantity = isYes ? pos.yesTokenBalance : pos.noTokenBalance;
            const pnlResult = calculatePnl({
              quantity,
              avgEntryPrice: pos.avgEntryPrice,
              currentPrice: pos.avgEntryPrice + pos.unrealizedPnl / quantity,
            });

            return (
              <Card key={pos.marketAddress}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pos.ticker}</CardTitle>
                    <Badge variant={isYes ? 'yes' : 'no'}>
                      {isYes ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Strike: {formatUSD(pos.strikePrice)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Qty</span>
                    <span className="font-mono">{quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Entry</span>
                    <span className="font-mono">
                      {formatPrice(pos.avgEntryPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">P&L</span>
                    <span
                      className={cn(
                        'font-mono font-medium',
                        pnlResult.pnl >= 0 ? 'text-yes' : 'text-no',
                      )}
                    >
                      {pnlResult.pnl >= 0 ? '+' : ''}
                      {formatUSD(pnlResult.pnl)}
                    </span>
                  </div>
                  <Link href={`/trade/${pos.marketAddress}`}>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      Trade
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
