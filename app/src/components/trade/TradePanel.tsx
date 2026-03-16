'use client';

import { useState, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
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
import { IS_DEMO_MODE } from '@/lib/demo';
import { useDemoState } from '@/providers/DemoStateProvider';
import { useToast } from '@/providers/ToastProvider';

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
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState(defaultPrice.toFixed(2));
  const { submitOrder, isSubmitting } = useTradeActions();
  const { publicKey: walletPublicKey } = useWallet();
  const { actions: demoActions } = useDemoState();
  const { showToast } = useToast();

  const parsedSize = useMemo(() => {
    const n = parseFloat(size);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [size]);

  const parsedPrice = useMemo(() => {
    const n = parseFloat(price);
    return isNaN(n) || n <= 0 || n >= 1 ? 0 : n;
  }, [price]);

  const isAllowed = isTradeSideAllowed(selectedSide, position);
  const isMarketOrder = orderType === 'market';
  const priceValid = isMarketOrder || parsedPrice > 0;
  const canSubmit = parsedSize > 0 && priceValid && isAllowed && !isSubmitting && (IS_DEMO_MODE || !!walletPublicKey);

  const effectivePrice = isMarketOrder ? 0.50 : parsedPrice;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const order: TradeOrder = {
      marketAddress: market.address,
      side: selectedSide,
      size: parsedSize,
      price: effectivePrice,
      traderPublicKey: walletPublicKey?.toBase58() ?? '',
    };

    try {
      await submitOrder(order);

      // Build a human-readable label for the toast
      const sideLabel = TRADE_TABS.find((t) => t.value === selectedSide)?.label ?? selectedSide;
      showToast(`${sideLabel}: ${parsedSize} contracts on ${market.ticker}`);

      // In demo mode, update the balance
      if (IS_DEMO_MODE) {
        if (selectedSide === TradeSide.BUY_YES) {
          // Minting a pair costs $1 per contract
          demoActions.deductBalance(parsedSize);
        } else if (selectedSide === TradeSide.BUY_NO) {
          // Buying NO costs contracts * price
          demoActions.deductBalance(parsedSize * effectivePrice);
        }
      }

      setSize('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Trade failed: ${message}`, 'error');
    }
  }, [canSubmit, market.address, market.ticker, selectedSide, parsedSize, effectivePrice, walletPublicKey, submitOrder, showToast, demoActions]);

  const confirmation = useTradeConfirmation(handleSubmit);

  const handleTradeClick = useCallback(() => {
    if (!canSubmit) return;
    confirmation.requestConfirmation({
      side: selectedSide,
      size: parsedSize,
      price: effectivePrice,
      ticker: market.ticker,
      strikePrice: market.strikePrice,
    });
  }, [canSubmit, confirmation, selectedSide, parsedSize, effectivePrice, market]);

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
                <label htmlFor="trade-size-input" className="text-sm font-medium">Contracts</label>
                <Input
                  id="trade-size-input"
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
                <span className="text-sm font-medium">Order Type</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={orderType === 'market' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderType('market')}
                    data-testid="order-type-market"
                  >
                    Market
                  </Button>
                  <Button
                    type="button"
                    variant={orderType === 'limit' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderType('limit')}
                    data-testid="order-type-limit"
                  >
                    Limit
                  </Button>
                </div>
              </div>

              {orderType === 'limit' && (
                <div className="space-y-2">
                  <label htmlFor="trade-price-input" className="text-sm font-medium">Limit Price</label>
                  <Input
                    id="trade-price-input"
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
              )}

              {parsedSize > 0 && (isMarketOrder || parsedPrice > 0) && (
                <PayoffDisplay
                  side={tab.value}
                  size={parsedSize}
                  price={effectivePrice}
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
