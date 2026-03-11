'use client';

import type { OrderBookState, OrderBookEntry } from '@meridian/shared/types';
import { toNoPerspective } from '@/lib/perspective';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/cn';

type Perspective = 'yes' | 'no';

interface OrderBookProps {
  readonly orderBookData: OrderBookState;
  readonly perspective: Perspective;
}

function OrderRow({
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
      className="relative flex items-center justify-between px-2 py-1 text-xs font-mono"
      data-testid="order-row"
    >
      <div
        className={cn(
          'absolute inset-0 opacity-10',
          isBid ? 'bg-yes' : 'bg-no',
        )}
        style={{ width: `${widthPercent}%` }}
      />
      <span className={cn('relative z-10', isBid ? 'text-yes' : 'text-no')}>
        {formatPrice(entry.price)}
      </span>
      <span className="relative z-10 text-muted-foreground">{entry.size}</span>
    </div>
  );
}

function OrderBookSide({
  entries,
  isBid,
}: {
  readonly entries: readonly OrderBookEntry[];
  readonly isBid: boolean;
}) {
  const maxSize = Math.max(...entries.map((e) => e.size), 1);

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between px-2 text-xs text-muted-foreground font-medium mb-1">
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
        <p className="text-center text-xs text-muted-foreground py-2">
          No orders
        </p>
      )}
    </div>
  );
}

export function OrderBook({ orderBookData, perspective }: OrderBookProps) {
  const book =
    perspective === 'no' ? toNoPerspective(orderBookData) : orderBookData;

  return (
    <div
      className="rounded-lg border p-3"
      data-testid="order-book"
      data-perspective={perspective}
    >
      <h3 className="text-sm font-semibold mb-3">
        &ldquo;{perspective === 'yes' ? 'Yes' : 'No'}&rdquo; Order Book
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-yes mb-1">Bids</p>
          <OrderBookSide entries={book.bids} isBid={true} />
        </div>
        <div>
          <p className="text-xs font-medium text-no mb-1">Asks</p>
          <OrderBookSide entries={book.asks} isBid={false} />
        </div>
      </div>

      {book.spread !== null && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Spread: {formatPrice(book.spread)}
        </p>
      )}
    </div>
  );
}
