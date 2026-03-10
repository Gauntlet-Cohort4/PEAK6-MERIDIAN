'use client';

import { Button } from '@/components/ui/button';
import { MERIDIAN_CONFIG, type SupportedTicker } from '@meridian/shared/constants';
import { cn } from '@/lib/cn';

interface TickerFilterProps {
  readonly selected: SupportedTicker | null;
  readonly onSelect: (ticker: SupportedTicker | null) => void;
}

export function TickerFilter({ selected, onSelect }: TickerFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="ticker-filter">
      <Button
        variant={selected === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelect(null)}
      >
        All
      </Button>
      {MERIDIAN_CONFIG.SUPPORTED_TICKERS.map((ticker) => (
        <Button
          key={ticker}
          variant={selected === ticker ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(ticker)}
          className={cn(selected === ticker && 'bg-primary')}
        >
          {ticker}
        </Button>
      ))}
    </div>
  );
}
