import { describe, it, expect } from 'vitest';
import { toNoPerspective } from '../../src/lib/perspective';
import type { OrderBookState } from '@meridian/shared/types';

describe('toNoPerspective', () => {
  const yesBook: OrderBookState = {
    marketAddress: 'test-market',
    bids: [
      { price: 0.60, size: 10, side: 'bid' },
      { price: 0.58, size: 20, side: 'bid' },
    ],
    asks: [
      { price: 0.65, size: 15, side: 'ask' },
      { price: 0.68, size: 25, side: 'ask' },
    ],
    lastUpdated: 1000,
    spread: 0.05,
  };

  it('inverts ask prices to No bids', () => {
    const noBook = toNoPerspective(yesBook);
    // Yes asks at 0.65 and 0.68 become No bids at 0.35 and 0.32
    expect(noBook.bids).toHaveLength(2);
    expect(noBook.bids[0].price).toBe(0.35);
    expect(noBook.bids[0].side).toBe('bid');
    expect(noBook.bids[1].price).toBe(0.32);
  });

  it('inverts bid prices to No asks', () => {
    const noBook = toNoPerspective(yesBook);
    // Yes bids at 0.60 and 0.58 become No asks at 0.40 and 0.42
    expect(noBook.asks).toHaveLength(2);
    expect(noBook.asks[0].price).toBe(0.4);
    expect(noBook.asks[1].price).toBe(0.42);
    expect(noBook.asks[0].side).toBe('ask');
  });

  it('preserves sizes', () => {
    const noBook = toNoPerspective(yesBook);
    expect(noBook.bids[0].size).toBe(15);
    expect(noBook.asks[0].size).toBe(10);
  });

  it('calculates spread correctly', () => {
    const noBook = toNoPerspective(yesBook);
    // No best bid = 0.35, No best ask = 0.40, spread = 0.05
    expect(noBook.spread).toBeCloseTo(0.05, 2);
  });

  it('preserves market address and timestamp', () => {
    const noBook = toNoPerspective(yesBook);
    expect(noBook.marketAddress).toBe('test-market');
    expect(noBook.lastUpdated).toBe(1000);
  });

  it('handles empty books', () => {
    const emptyBook: OrderBookState = {
      marketAddress: 'empty',
      bids: [],
      asks: [],
      lastUpdated: 1000,
      spread: null,
    };
    const noBook = toNoPerspective(emptyBook);
    expect(noBook.bids).toHaveLength(0);
    expect(noBook.asks).toHaveLength(0);
    expect(noBook.spread).toBeNull();
  });
});
