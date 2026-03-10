'use client';

import { useState, useCallback, useMemo } from 'react';
import { TradeSide } from '@meridian/shared/types';
import type { StrikeMarket, Position, TradeOrder } from '@meridian/shared/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PayoffDisplay } from './PayoffDisplay';
import { PositionConstraints } from './PositionConstraints';
import { TradeConfirmation } from './TradeConfirmation';
import { useTradeActions } from '@/hooks/useTradeActions';
import { useTradeConfirmation } from '@/hooks/useTradeConfirmation';
import { isTradeSideAllowed } from '@/lib/position-constraints';

interface TradePanelProps {
  readonly market: StrikeMarket;
  readonly position: Position | null;
  readonly defaultPrice?: number;
}

const TRADE_TABS: readonly { readonly value: TradeSide; readonly label: string }[] = [
  { value: TradeSide.BUY_YES, label: 'Buy Yes' },
  { value: TradeSide.BUY_NO, label: 'Buy No' },
  { value: TradeSide.SELL_YES, label: 'Sell Yes' },
  { value: TradeSide.SELL_NO, label: 'Sell No' },
];

export function TradePanel({ market, position, defaultPrice = 0.5 }: TradePanelProps) {
  const [selectedSide, setSelectedSide] = useState<TradeSide>(TradeSide.BUY_YES);
  const [size, setSize] = useState('');
  const [price, setPrice] = useState(defaultPrice.toFixed(2));
  const { submitOrder, isSubmitting } = useTradeActions();

  const parsedSize = useMemo(() => {
    const n = parseFloat(size);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [size]);

  const parsedPrice = useMemo(() => {
    const n = parseFloat(price);
    return isNaN(n) || n <= 0 || n >= 1 ? 0 : n;
  }, [price]);

  const isAllowed = isTradeSideAllowed(selectedSide, position);
  const canSubmit = parsedSize > 0 && parsedPrice > 0 && isAllowed && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const order: TradeOrder = {
      marketAddress: market.address,
      side: selectedSide,
      size: parsedSize,
      price: parsedPrice,
      traderPublicKey: 'mock-trader-pubkey',
    };

    await submitOrder(order);
    setSize('');
  }, [canSubmit, market.address, selectedSide, parsedSize, parsedPrice, submitOrder]);

  const confirmation = useTradeConfirmation(handleSubmit);

  const handleTradeClick = useCallback(() => {
    if (!canSubmit) return;
    confirmation.requestConfirmation({
      side: selectedSide,
      size: parsedSize,
      price: parsedPrice,
      ticker: market.ticker,
      strikePrice: market.strikePrice,
    });
  }, [canSubmit, confirmation, selectedSide, parsedSize, parsedPrice, market]);

  return (
    <div className="space-y-4" data-testid="trade-panel">
      <Tabs
        value={selectedSide}
        onValueChange={(v) => setSelectedSide(v as TradeSide)}
      >
        <TabsList className="grid w-full grid-cols-4">
          {TRADE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TRADE_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="space-y-4 pt-2">
              <PositionConstraints position={position} selectedSide={tab.value} />

              <div className="space-y-2">
                <label className="text-sm font-medium">Contracts</label>
                <Input
                  type="number"
                  placeholder="0"
                  min="1"
                  step="1"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  data-testid="size-input"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Limit Price</label>
                <Input
                  type="number"
                  placeholder="0.50"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  data-testid="price-input"
                />
              </div>

              {parsedSize > 0 && parsedPrice > 0 && (
                <PayoffDisplay
                  side={tab.value}
                  size={parsedSize}
                  price={parsedPrice}
                  ticker={market.ticker}
                  strikePrice={market.strikePrice}
                />
              )}

              <Button
                className="w-full"
                variant={
                  tab.value === TradeSide.BUY_YES || tab.value === TradeSide.SELL_NO
                    ? 'yes'
                    : 'no'
                }
                disabled={!canSubmit}
                onClick={handleTradeClick}
                data-testid="submit-trade-button"
              >
                {isSubmitting ? 'Submitting...' : tab.label}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <TradeConfirmation
        isOpen={confirmation.isOpen}
        data={confirmation.confirmationData}
        skipConfirmation={confirmation.skipConfirmation}
        onConfirm={confirmation.confirm}
        onCancel={confirmation.cancel}
        onSkipChange={confirmation.setSkip}
      />
    </div>
  );
}
