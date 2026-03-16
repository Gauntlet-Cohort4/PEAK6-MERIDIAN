'use client';

import { MERIDIAN_CONFIG, type SupportedTicker } from '@meridian/shared/constants';
import { cn } from '@/lib/cn';

interface TickerFilterProps {
  readonly selected: SupportedTicker | null;
  readonly onSelect: (ticker: SupportedTicker | null) => void;
}

export function TickerFilter({ selected, onSelect }: TickerFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="ticker-filter">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
          selected === null
            ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.4)]'
            : 'bg-[#111827] text-[#64748b] border-[#1e2a3a] hover:text-[#e2e8f0] hover:border-[#3b82f6]/50',
        )}
      >
        All
      </button>
      {MERIDIAN_CONFIG.SUPPORTED_TICKERS.map((ticker) => (
        <button
          key={ticker}
          type="button"
          onClick={() => onSelect(ticker)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
            selected === ticker
              ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.4)]'
              : 'bg-[#111827] text-[#64748b] border-[#1e2a3a] hover:text-[#e2e8f0] hover:border-[#3b82f6]/50',
          )}
        >
          {ticker}
        </button>
      ))}
    </div>
  );
}
