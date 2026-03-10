/**
 * @module perspective
 * Convert order book between Yes and No perspectives.
 *
 * In a binary options market, Yes and No are complements:
 * - No bid at price P = Yes ask at price (1 - P)
 * - No ask at price P = Yes bid at price (1 - P)
 */

import type { OrderBookState, OrderBookEntry } from '@meridian/shared/types';

/**
 * Invert a single order book entry's price: newPrice = 1 - oldPrice.
 * Bids become asks and vice versa.
 */
function invertEntry(
  entry: OrderBookEntry,
  newSide: 'bid' | 'ask',
): OrderBookEntry {
  return {
    price: parseFloat((1 - entry.price).toFixed(4)),
    size: entry.size,
    side: newSide,
  };
}

/**
 * Convert a Yes-perspective order book into a No-perspective order book.
 *
 * Yes bids -> No asks (inverted prices, sorted ascending)
 * Yes asks -> No bids (inverted prices, sorted descending)
 */
export function toNoPerspective(yesBook: OrderBookState): OrderBookState {
  const noBids: readonly OrderBookEntry[] = [...yesBook.asks]
    .map((entry) => invertEntry(entry, 'bid'))
    .sort((a, b) => b.price - a.price);

  const noAsks: readonly OrderBookEntry[] = [...yesBook.bids]
    .map((entry) => invertEntry(entry, 'ask'))
    .sort((a, b) => a.price - b.price);

  const bestBid = noBids.length > 0 ? noBids[0].price : null;
  const bestAsk = noAsks.length > 0 ? noAsks[0].price : null;
  const spread =
    bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  return {
    marketAddress: yesBook.marketAddress,
    bids: noBids,
    asks: noAsks,
    lastUpdated: yesBook.lastUpdated,
    spread,
  };
}
