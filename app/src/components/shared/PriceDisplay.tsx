'use client';

import { usePythPrice } from '@/hooks/usePythPrice';
import { formatUSD } from '@/lib/format';
import { LoadingSpinner } from './LoadingSpinner';
import type { SupportedTicker } from '@meridian/shared/constants';
import { cn } from '@/lib/cn';

interface PriceDisplayProps {
  readonly ticker: SupportedTicker;
  readonly className?: string;
}

export function PriceDisplay({ ticker, className }: PriceDisplayProps) {
  const { priceData, isLoading, error } = usePythPrice(ticker);

  if (isLoading) {
    return <LoadingSpinner size="sm" className={className} />;
  }

  if (error || !priceData) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        Price unavailable
      </span>
    );
  }

  return (
    <span
      className={cn('text-sm font-mono font-medium', className)}
      data-testid="price-display"
    >
      {formatUSD(priceData.price)}
    </span>
  );
}
