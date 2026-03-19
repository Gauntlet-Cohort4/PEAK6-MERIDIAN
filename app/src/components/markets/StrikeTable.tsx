'use client';

/**
 * @module StrikeTable
 * Compact table view of strike contracts within an expanded ticker group.
 * Replaces the grid of individual MarketCards with a dense, scannable table.
 */

import { memo, useMemo } from 'react';
import Link from 'next/link';
import type { StrikeMarket, OrderBookState, Position } from '@meridian/shared/types';
import { Badge } from '@/components/ui/badge';
import { formatUSD, formatPrice } from '@/lib/format';
import { calcImpliedProbability, isOneSidedBook } from '@/lib/implied-probability';
import { cn } from '@/lib/cn';

interface StrikeTableProps {
  readonly markets: readonly StrikeMarket[];
  readonly orderBooks: Record<string, OrderBookState>;
  readonly getPosition: (marketAddress: string) => Position | null;
}

interface StrikeRowData {
  readonly market: StrikeMarket;
  readonly yesPrice: number | null;
  readonly noPrice: number | null;
  readonly oneSided: boolean;
  readonly position: Position | null;
}

function getBestPrices(book: OrderBookState | null): {
  bestBid: number | null;
  bestAsk: number | null;
} {
  if (!book) {
    return { bestBid: null, bestAsk: null };
  }
  const bestBid = book.bids.length > 0 ? book.bids[0].price : null;
  const bestAsk = book.asks.length > 0 ? book.asks[0].price : null;
  return { bestBid, bestAsk };
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'border-[#00d26a] text-[#00d26a]',
  PENDING: 'border-[#64748b] text-[#64748b]',
  CLOSED: 'border-[#f0b90b] text-[#f0b90b]',
  SETTLED: 'border-[#3b82f6] text-[#3b82f6]',
  CANCELLED: 'border-[#ff3b69] text-[#ff3b69]',
};

function StrikeRow({ row }: { readonly row: StrikeRowData }) {
  const { market, yesPrice, noPrice, oneSided, position } = row;
  const statusStyle = STATUS_STYLES[market.status] ?? STATUS_STYLES.PENDING;

  return (
    <Link
      href={`/trade/${market.address}`}
      className="group contents"
      data-testid={`strike-row-${market.strikePrice}`}
    >
      {/* Strike */}
      <div className="px-3 py-2 font-mono text-sm text-[#e2e8f0] group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a]">
        {formatUSD(market.strikePrice)}
      </div>

      {/* Date */}
      <div className="px-3 py-2 text-xs text-[#64748b] group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a] hidden sm:block">
        {new Date(market.expiryTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>

      {/* Status */}
      <div className="px-3 py-2 group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a]">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 font-medium',
            statusStyle,
          )}
        >
          {market.status}
        </Badge>
      </div>

      {/* YES price */}
      <div className="px-3 py-2 font-mono text-sm group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a]">
        {yesPrice !== null ? (
          <span className="text-[#00d26a]">{formatPrice(yesPrice)}</span>
        ) : (
          <span className="text-[#64748b]">{'\u2014'}</span>
        )}
      </div>

      {/* NO price */}
      <div className="px-3 py-2 font-mono text-sm group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a]">
        {noPrice !== null ? (
          <span className="text-[#ff3b69]">{formatPrice(noPrice)}</span>
        ) : (
          <span className="text-[#64748b]">{'\u2014'}</span>
        )}
      </div>

      {/* Minted */}
      <div className="px-3 py-2 font-mono text-sm text-[#64748b] group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a]">
        {market.totalPairsMinted}
      </div>

      {/* Position (YES/NO balances) */}
      <div className="px-3 py-2 font-mono text-xs group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a] hidden md:block">
        {position && (position.yesTokenBalance > 0 || position.noTokenBalance > 0) ? (
          <span>
            {position.yesTokenBalance > 0 && (
              <span className="text-[#00d26a]">{position.yesTokenBalance}Y</span>
            )}
            {position.yesTokenBalance > 0 && position.noTokenBalance > 0 && (
              <span className="text-[#64748b]">/</span>
            )}
            {position.noTokenBalance > 0 && (
              <span className="text-[#ff3b69]">{position.noTokenBalance}N</span>
            )}
          </span>
        ) : (
          <span className="text-[#64748b]">{'\u2014'}</span>
        )}
      </div>

      {/* Action */}
      <div className="px-3 py-2 group-hover:bg-[#1a2035] transition-colors border-b border-[#1e2a3a]">
        <span className="text-xs text-[#3b82f6] group-hover:text-[#60a5fa] transition-colors whitespace-nowrap">
          Trade {'\u2192'}
        </span>
        {oneSided && (
          <Badge
            variant="warning"
            className="text-[9px] px-1 py-0 ml-1 hidden lg:inline-flex"
            data-testid="low-liquidity-badge"
          >
            Low Liq
          </Badge>
        )}
      </div>
    </Link>
  );
}

function StrikeTableInner({ markets, orderBooks, getPosition }: StrikeTableProps) {
  const rows: readonly StrikeRowData[] = useMemo(() => {
    const sorted = [...markets].sort((a, b) => a.strikePrice - b.strikePrice);
    return sorted.map((market) => {
      const book = orderBooks[market.address] ?? null;
      const { bestBid, bestAsk } = getBestPrices(book);
      const probability = calcImpliedProbability(bestBid, bestAsk);
      const oneSided = isOneSidedBook(bestBid, bestAsk);
      const yesPrice = probability;
      const noPrice = probability !== null ? 1 - probability : null;
      const position = getPosition(market.address);
      return { market, yesPrice, noPrice, oneSided, position };
    });
  }, [markets, orderBooks, getPosition]);

  if (rows.length === 0) {
    return (
      <p className="text-center text-[#64748b] py-4 text-sm">
        No strike contracts
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="strike-table">
      <div
        className="grid min-w-[600px]"
        style={{
          gridTemplateColumns: '1fr auto auto 80px 80px 80px auto auto',
        }}
        role="table"
        aria-label="Strike contracts"
      >
        {/* Header */}
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#64748b] border-b border-[#1e2a3a] font-semibold" role="columnheader">
          Strike
        </div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#64748b] border-b border-[#1e2a3a] font-semibold hidden sm:block" role="columnheader">
          Date
        </div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#64748b] border-b border-[#1e2a3a] font-semibold" role="columnheader">
          Status
        </div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#00d26a] border-b border-[#1e2a3a] font-semibold" role="columnheader">
          YES
        </div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#ff3b69] border-b border-[#1e2a3a] font-semibold" role="columnheader">
          NO
        </div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#64748b] border-b border-[#1e2a3a] font-semibold" role="columnheader">
          Minted
        </div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#64748b] border-b border-[#1e2a3a] font-semibold hidden md:block" role="columnheader">
          Position
        </div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#64748b] border-b border-[#1e2a3a] font-semibold" role="columnheader">
          Action
        </div>

        {/* Rows */}
        {rows.map((row) => (
          <StrikeRow key={row.market.address} row={row} />
        ))}
      </div>
    </div>
  );
}

export const StrikeTable = memo(StrikeTableInner);
export default StrikeTable;
