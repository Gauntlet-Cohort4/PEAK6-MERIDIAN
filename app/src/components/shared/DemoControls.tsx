'use client';

import { useState, useCallback, useMemo } from 'react';
import { useDemoState } from '@/providers/DemoStateProvider';
import { MarketStatus } from '@meridian/shared/types';
import type { StrikeMarket } from '@meridian/shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatUSD } from '@/lib/format';
import { IS_DEMO_MODE } from '@/lib/demo';

// ---------------------------------------------------------------------------
// Market-level controls (shown on trade page or market card)
// ---------------------------------------------------------------------------

interface DemoMarketControlsProps {
  readonly market: StrikeMarket;
}

export function DemoMarketControls({ market }: DemoMarketControlsProps) {
  // All hooks MUST be called before any early returns (Rules of Hooks)
  const { actions } = useDemoState();
  const [settlementPrice, setSettlementPrice] = useState('');

  const parsedPrice = useMemo(() => parseFloat(settlementPrice), [settlementPrice]);
  const isValidPrice = !isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice <= 1_000_000;

  const handleSettleYes = useCallback(() => {
    if (!isValidPrice) return;
    // Settle with price >= strike so YES wins
    const price = Math.max(parsedPrice, market.strikePrice);
    actions.settleMarket(market.address, price);
    setSettlementPrice('');
  }, [actions, market.address, market.strikePrice, parsedPrice, isValidPrice]);

  const handleSettleNo = useCallback(() => {
    if (!isValidPrice) return;
    // Settle with price < strike so NO wins
    const price = Math.min(parsedPrice, market.strikePrice - 0.01);
    actions.settleMarket(market.address, price);
    setSettlementPrice('');
  }, [actions, market.address, market.strikePrice, parsedPrice, isValidPrice]);

  const handleReopen = useCallback(() => {
    actions.reopenMarket(market.address);
  }, [actions, market.address]);

  const handleMintPair = useCallback(() => {
    actions.addPosition(market.address, 10, 10);
  }, [actions, market.address]);

  if (!IS_DEMO_MODE) return null;

  if (market.status === MarketStatus.SETTLED) {
    return (
      <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">
            Demo
          </Badge>
          <span className="text-xs text-muted-foreground">Market settled</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleReopen}
        >
          Reopen Market
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">
          Demo Controls
        </Badge>
      </div>

      {/* Mint pair */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleMintPair}
      >
        Mint 10 Pairs (YES + NO)
      </Button>

      {/* Force settle */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          Settlement Price (strike: {formatUSD(market.strikePrice)})
        </label>
        <Input
          type="number"
          placeholder={`e.g. ${(market.strikePrice * 1.05).toFixed(2)}`}
          step="0.01"
          value={settlementPrice}
          onChange={(e) => setSettlementPrice(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="yes"
            size="sm"
            disabled={!isValidPrice}
            onClick={handleSettleYes}
          >
            Settle YES
          </Button>
          <Button
            variant="no"
            size="sm"
            disabled={!isValidPrice}
            onClick={handleSettleNo}
          >
            Settle NO
          </Button>
        </div>
        {isValidPrice && (
          <p className="text-xs text-muted-foreground">
            {parsedPrice >= market.strikePrice
              ? `${formatUSD(parsedPrice)} >= ${formatUSD(market.strikePrice)} = YES wins`
              : `${formatUSD(parsedPrice)} < ${formatUSD(market.strikePrice)} = NO wins`}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global demo toolbar (shown in header or as floating panel)
// ---------------------------------------------------------------------------

export function DemoToolbar() {
  // Hook must be called before early return (Rules of Hooks)
  const { actions } = useDemoState();

  if (!IS_DEMO_MODE) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={actions.resetAll}
      className="text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/10"
    >
      Reset Demo
    </Button>
  );
}
