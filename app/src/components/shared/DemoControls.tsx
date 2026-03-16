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
import { useToast } from '@/providers/ToastProvider';
import type { OrderBookState, Position } from '@meridian/shared/types';

// ---------------------------------------------------------------------------
// Market-level controls (shown on trade page or market card)
// ---------------------------------------------------------------------------

interface DemoMarketControlsProps {
  readonly market: StrikeMarket;
  readonly orderBook?: OrderBookState | null;
  readonly position?: Position | null;
}

export function DemoMarketControls({ market, orderBook, position }: DemoMarketControlsProps) {
  // All hooks MUST be called before any early returns (Rules of Hooks)
  const { actions } = useDemoState();
  const { showToast } = useToast();
  const [settlementPrice, setSettlementPrice] = useState('');

  const parsedPrice = useMemo(() => parseFloat(settlementPrice), [settlementPrice]);
  const isValidPrice = !isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice <= 1_000_000;

  const handleSettleYes = useCallback(() => {
    if (!isValidPrice) return;
    // Settle with price >= strike so YES wins
    const price = Math.max(parsedPrice, market.strikePrice);
    actions.settleMarket(market.address, price);
    setSettlementPrice('');
    showToast(`Settled ${market.ticker} at ${formatUSD(price)} - YES wins`);
  }, [actions, market.address, market.strikePrice, market.ticker, parsedPrice, isValidPrice, showToast]);

  const handleSettleNo = useCallback(() => {
    if (!isValidPrice) return;
    // Settle with price < strike so NO wins
    const price = Math.min(parsedPrice, market.strikePrice - 0.01);
    actions.settleMarket(market.address, price);
    setSettlementPrice('');
    showToast(`Settled ${market.ticker} at ${formatUSD(price)} - NO wins`);
  }, [actions, market.address, market.strikePrice, market.ticker, parsedPrice, isValidPrice, showToast]);

  const handleReopen = useCallback(() => {
    actions.reopenMarket(market.address);
    showToast(`Reopened ${market.ticker} market`, 'info');
  }, [actions, market.address, market.ticker, showToast]);

  // Derive best YES/NO prices from order book, default to 0.50 each
  const yesPrice = orderBook?.asks[0]?.price ?? 0.50;
  const noPrice = 1 - yesPrice;

  // Block minting the opposite side if already holding a position
  const holdingYes = (position?.yesTokenBalance ?? 0) > 0;
  const holdingNo = (position?.noTokenBalance ?? 0) > 0;
  const canMintYes = !holdingNo;   // Can't mint YES if already holding NO
  const canMintNo = !holdingYes;   // Can't mint NO if already holding YES

  const handleMintYes = useCallback(() => {
    const cost = 10 * yesPrice;
    actions.addPosition(market.address, 10, 0);
    actions.deductBalance(cost);
    showToast(`Minted 10 YES for ${market.ticker} (cost: ${formatUSD(cost)})`);
  }, [actions, market.address, market.ticker, yesPrice, showToast]);

  const handleMintNo = useCallback(() => {
    const cost = 10 * noPrice;
    actions.addPosition(market.address, 0, 10);
    actions.deductBalance(cost);
    showToast(`Minted 10 NO for ${market.ticker} (cost: ${formatUSD(cost)})`);
  }, [actions, market.address, market.ticker, noPrice, showToast]);

  if (!IS_DEMO_MODE) return null;

  if (market.status === MarketStatus.SETTLED) {
    return (
      <div className="p-3 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/5 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
            Demo
          </Badge>
          <span className="text-[10px] text-[#64748b]">Market settled</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10"
          onClick={handleReopen}
        >
          Reopen Market
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/5 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="warning" className="text-[10px] px-1.5 py-0">
          Demo Controls
        </Badge>
      </div>

      {/* Mint YES / NO (mint pair + auto-sell opposite side) */}
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="border-[#00d26a]/30 text-[#00d26a] hover:bg-[#00d26a]/10 text-xs"
          onClick={handleMintYes}
          disabled={!canMintYes}
          title={!canMintYes ? 'Sell your NO position first' : undefined}
        >
          Mint 10 YES
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-[#ff3b69]/30 text-[#ff3b69] hover:bg-[#ff3b69]/10 text-xs"
          onClick={handleMintNo}
          disabled={!canMintNo}
          title={!canMintNo ? 'Sell your YES position first' : undefined}
        >
          Mint 10 NO
        </Button>
      </div>
      <p className="text-[10px] text-[#64748b]">
        YES @ {formatUSD(yesPrice)} | NO @ {formatUSD(noPrice)}
        {(!canMintYes || !canMintNo) && (
          <span className="block text-[#f59e0b] mt-0.5">
            Close your {holdingYes ? 'YES' : 'NO'} position to mint the other side
          </span>
        )}
      </p>

      {/* Force settle */}
      <div className="space-y-1.5">
        <label htmlFor="demo-settlement-price" className="text-[10px] text-[#64748b]">
          Settlement Price (strike: {formatUSD(market.strikePrice)})
        </label>
        <Input
          id="demo-settlement-price"
          type="number"
          placeholder={`e.g. ${(market.strikePrice * 1.05).toFixed(2)}`}
          step="0.01"
          value={settlementPrice}
          onChange={(e) => setSettlementPrice(e.target.value)}
          className="h-7 text-xs"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="yes"
            size="sm"
            disabled={!isValidPrice}
            onClick={handleSettleYes}
            className="text-xs h-7"
          >
            Settle YES
          </Button>
          <Button
            variant="no"
            size="sm"
            disabled={!isValidPrice}
            onClick={handleSettleNo}
            className="text-xs h-7"
          >
            Settle NO
          </Button>
        </div>
        {isValidPrice && (
          <p className="text-[10px] text-[#64748b]">
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
      className="text-[#f59e0b] border-[#f59e0b]/30 hover:bg-[#f59e0b]/10 text-xs h-7"
    >
      Reset Demo
    </Button>
  );
}
