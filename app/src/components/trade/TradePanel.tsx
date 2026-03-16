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
import { cn } from '@/lib/cn';

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

  // Max sellable quantity based on token holdings
  const isSell = selectedSide === TradeSide.SELL_YES || selectedSide === TradeSide.SELL_NO;
  const maxSellSize = selectedSide === TradeSide.SELL_YES
    ? (position?.yesTokenBalance ?? 0)
    : selectedSide === TradeSide.SELL_NO
      ? (position?.noTokenBalance ?? 0)
      : Infinity;
  const sizeExceedsHolding = isSell && parsedSize > maxSellSize;

  const canSubmit = parsedSize > 0 && priceValid && isAllowed && !isSubmitting && !sizeExceedsHolding && (IS_DEMO_MODE || !!walletPublicKey);

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

      // In demo mode, update the balance and position
      if (IS_DEMO_MODE) {
        if (selectedSide === TradeSide.BUY_YES) {
          demoActions.deductBalance(parsedSize);
        } else if (selectedSide === TradeSide.BUY_NO) {
          demoActions.deductBalance(parsedSize * effectivePrice);
        } else if (selectedSide === TradeSide.SELL_YES) {
          demoActions.redeemPosition(market.address, true, parsedSize);
          demoActions.creditBalance(parsedSize * effectivePrice);
        } else if (selectedSide === TradeSide.SELL_NO) {
          demoActions.redeemPosition(market.address, false, parsedSize);
          demoActions.creditBalance(parsedSize * effectivePrice);
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
    <div className="bg-[#111827] border border-[#1e2a3a] rounded-md p-3 space-y-3" data-testid="trade-panel">
      <Tabs
        value={selectedSide}
        onValueChange={(v) => setSelectedSide(v as TradeSide)}
      >
        <TabsList className="grid w-full grid-cols-4 bg-[#0a0e17] rounded-md p-0.5 h-auto">
          {TRADE_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'text-xs py-1.5 rounded-sm font-medium transition-all data-[state=active]:shadow-none',
                'data-[state=inactive]:text-[#64748b] data-[state=inactive]:bg-transparent',
                (tab.value === TradeSide.BUY_YES || tab.value === TradeSide.SELL_NO)
                  ? 'data-[state=active]:bg-[#00d26a]/10 data-[state=active]:text-[#00d26a]'
                  : 'data-[state=active]:bg-[#ff3b69]/10 data-[state=active]:text-[#ff3b69]',
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TRADE_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="space-y-3 pt-2">
              <PositionConstraints position={position} selectedSide={tab.value} />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="trade-size-input" className="text-xs font-medium text-[#64748b]">Contracts</label>
                  {isSell && maxSellSize > 0 && (
                    <button
                      type="button"
                      onClick={() => setSize(String(maxSellSize))}
                      className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
                    >
                      Max: {maxSellSize}
                    </button>
                  )}
                </div>
                <Input
                  id="trade-size-input"
                  type="number"
                  placeholder="0"
                  min="1"
                  max={isSell ? maxSellSize : undefined}
                  step="1"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  data-testid="size-input"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-[#64748b]">Order Type</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOrderType('market')}
                    className={cn(
                      'px-3 py-1 rounded-sm text-xs font-medium transition-all border',
                      orderType === 'market'
                        ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                        : 'bg-transparent text-[#64748b] border-[#1e2a3a] hover:text-[#e2e8f0]',
                    )}
                    data-testid="order-type-market"
                  >
                    Market
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('limit')}
                    className={cn(
                      'px-3 py-1 rounded-sm text-xs font-medium transition-all border',
                      orderType === 'limit'
                        ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                        : 'bg-transparent text-[#64748b] border-[#1e2a3a] hover:text-[#e2e8f0]',
                    )}
                    data-testid="order-type-limit"
                  >
                    Limit
                  </button>
                </div>
              </div>

              {orderType === 'limit' && (
                <div className="space-y-1">
                  <label htmlFor="trade-price-input" className="text-xs font-medium text-[#64748b]">Limit Price</label>
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
                    className="font-mono"
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

              {sizeExceedsHolding && (
                <p className="text-[11px] text-[#ff3b69]">
                  You only hold {maxSellSize} — reduce size or click Max
                </p>
              )}

              <Button
                className={cn(
                  'w-full font-semibold text-sm',
                  (tab.value === TradeSide.BUY_YES || tab.value === TradeSide.SELL_NO)
                    ? 'bg-[#00d26a] hover:bg-[#00d26a]/90 text-white shadow-[0_0_12px_rgba(0,210,106,0.2)]'
                    : 'bg-[#ff3b69] hover:bg-[#ff3b69]/90 text-white shadow-[0_0_12px_rgba(255,59,105,0.2)]',
                )}
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
