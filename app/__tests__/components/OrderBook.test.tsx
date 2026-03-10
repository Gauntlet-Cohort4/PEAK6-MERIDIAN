import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderBook } from '../../src/components/trade/OrderBook';
import type { OrderBookState } from '@meridian/shared/types';

const mockBook: OrderBookState = {
  marketAddress: 'test-market',
  bids: [
    { price: 0.60, size: 10, side: 'bid' },
    { price: 0.58, size: 20, side: 'bid' },
  ],
  asks: [
    { price: 0.65, size: 15, side: 'ask' },
    { price: 0.68, size: 25, side: 'ask' },
  ],
  lastUpdated: Date.now(),
  spread: 0.05,
};

describe('OrderBook', () => {
  it('renders Yes perspective order book', () => {
    render(<OrderBook orderBookData={mockBook} perspective="yes" />);
    expect(screen.getByTestId('order-book')).toHaveAttribute(
      'data-perspective',
      'yes',
    );
    expect(screen.getByText('Yes Order Book')).toBeInTheDocument();
  });

  it('renders No perspective order book', () => {
    render(<OrderBook orderBookData={mockBook} perspective="no" />);
    expect(screen.getByTestId('order-book')).toHaveAttribute(
      'data-perspective',
      'no',
    );
    expect(screen.getByText('No Order Book')).toBeInTheDocument();
  });

  it('displays bid and ask entries', () => {
    render(<OrderBook orderBookData={mockBook} perspective="yes" />);
    const rows = screen.getAllByTestId('order-row');
    expect(rows.length).toBe(4); // 2 bids + 2 asks
  });

  it('displays spread', () => {
    render(<OrderBook orderBookData={mockBook} perspective="yes" />);
    expect(screen.getByText('Spread: 0.05')).toBeInTheDocument();
  });

  it('handles empty book', () => {
    const emptyBook: OrderBookState = {
      marketAddress: 'test',
      bids: [],
      asks: [],
      lastUpdated: Date.now(),
      spread: null,
    };
    render(<OrderBook orderBookData={emptyBook} perspective="yes" />);
    const noOrders = screen.getAllByText('No orders');
    expect(noOrders.length).toBe(2);
  });
});
