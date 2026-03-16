'use client';

import { memo } from 'react';
import type { OrderBookState, OrderBookEntry } from '@meridian/shared/types';
import { toNoPerspective } from '@/lib/perspective';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/cn';

type Perspective = 'yes' | 'no';

interface OrderBookProps {
  readonly orderBookData: OrderBookState;
  readonly perspective: Perspective;
}

const OrderRow = memo(function OrderRow({
  entry,
  isBid,
  maxSize,
}: {
  readonly entry: OrderBookEntry;
  readonly isBid: boolean;
  readonly maxSize: number;
}) {
  const widthPercent = maxSize > 0 ? (entry.size / maxSize) * 100 : 0;

  return (
    <div
      className="relative flex items-center justify-between px-2 py-0.5 text-xs font-mono"
      data-testid="order-row"
    >
      <div
        className={cn(
          'absolute inset-0 opacity-15',
          isBid ? 'bg-[#00d26a]' : 'bg-[#ff3b69]',
        )}
        style={{ width: `${widthPercent}%` }}
      />
      <span className={cn('relative z-10', isBid ? 'text-[#00d26a]' : 'text-[#ff3b69]')}>
        {formatPrice(entry.price)}
      </span>
      <span className="relative z-10 text-[#64748b]">{entry.size}</span>
    </div>
  );
});

const OrderBookSide = memo(function OrderBookSide({
  entries,
  isBid,
}: {
  readonly entries: readonly OrderBookEntry[];
  readonly isBid: boolean;
}) {
  const maxSize = Math.max(...entries.map((e) => e.size), 1);

  return (
    <div>
      <div className="flex justify-between px-2 text-[10px] uppercase tracking-wider text-[#64748b] font-medium mb-1">
        <span>Price</span>
        <span>Size</span>
      </div>
      {entries.map((entry, i) => (
        <OrderRow
          key={`${entry.price}-${i}`}
          entry={entry}
          isBid={isBid}
          maxSize={maxSize}
        />
      ))}
      {entries.length === 0 && (
        <p className="text-center text-[10px] text-[#64748b] py-2">
          No orders
        </p>
      )}
    </div>
  );
});

export const OrderBook = memo(function OrderBook({ orderBookData, perspective }: OrderBookProps) {
  const book =
    perspective === 'no' ? toNoPerspective(orderBookData) : orderBookData;

  return (
    <div
      className="rounded-md border border-[#1e2a3a] bg-[#111827] p-3"
      data-testid="order-book"
      data-perspective={perspective}
      aria-label={`${perspective === 'yes' ? 'Yes' : 'No'} order book`}
    >
      <h3 className="text-xs font-semibold text-[#e2e8f0] mb-2 uppercase tracking-wider">
        &ldquo;{perspective === 'yes' ? 'Yes' : 'No'}&rdquo; Order Book
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold text-[#00d26a] mb-1 uppercase tracking-wider">Bids</p>
          <OrderBookSide entries={book.bids} isBid={true} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#ff3b69] mb-1 uppercase tracking-wider">Asks</p>
          <OrderBookSide entries={book.asks} isBid={false} />
        </div>
      </div>

      {book.spread !== null && (
        <p className="text-[10px] text-[#64748b] font-mono text-center mt-2 py-1 border-t border-[#1e2a3a]">
          Spread: {formatPrice(book.spread)}
        </p>
      )}
    </div>
  );
});
