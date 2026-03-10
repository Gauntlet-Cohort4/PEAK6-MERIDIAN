'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PayoffDisplay } from './PayoffDisplay';
import { TradeSide } from '@meridian/shared/types';
import type { TradeConfirmationData } from '@/hooks/useTradeConfirmation';

interface TradeConfirmationProps {
  readonly isOpen: boolean;
  readonly data: TradeConfirmationData | null;
  readonly skipConfirmation: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly onSkipChange: (skip: boolean) => void;
}

function sideTradeSide(side: string): TradeSide {
  return (TradeSide as Record<string, TradeSide>)[side] ?? TradeSide.BUY_YES;
}

function sideLabel(side: string): string {
  return side.replace(/_/g, ' ');
}

export function TradeConfirmation({
  isOpen,
  data,
  skipConfirmation,
  onConfirm,
  onCancel,
  onSkipChange,
}: TradeConfirmationProps) {
  if (!data) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent data-testid="trade-confirmation">
        <DialogHeader>
          <DialogTitle>Confirm Trade</DialogTitle>
          <DialogDescription>
            {sideLabel(data.side)} {data.size} contracts at {data.price.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <PayoffDisplay
          side={sideTradeSide(data.side)}
          size={data.size}
          price={data.price}
          ticker={data.ticker}
          strikePrice={data.strikePrice}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skip-confirm"
            checked={skipConfirmation}
            onChange={(e) => onSkipChange(e.target.checked)}
            className="rounded border-input"
            data-testid="skip-confirmation-checkbox"
          />
          <label htmlFor="skip-confirm" className="text-sm text-muted-foreground">
            Don&apos;t show this confirmation again
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} data-testid="confirm-trade-button">
            Confirm Trade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
