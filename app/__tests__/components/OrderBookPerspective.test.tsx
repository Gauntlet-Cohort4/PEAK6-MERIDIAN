import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrderBook } from '../../src/components/trade/OrderBook';
import type { OrderBookState } from '@meridian/shared/types';

const mockBook: OrderBookState = {
  marketAddress: 'test-market',
  bids: [
    { price: 0.60, size: 10, side: 'bid' },
    { price: 0.58, size: 20, side: 'bid' },
    { price: 0.55, size: 30, side: 'bid' },
  ],
  asks: [
    { price: 0.65, size: 15, side: 'ask' },
    { price: 0.68, size: 25, side: 'ask' },
    { price: 0.72, size: 35, side: 'ask' },
  ],
  lastUpdated: Date.now(),
  spread: 0.05,
};

describe('OrderBook - Yes/No Perspective Views', () => {
  describe('Yes perspective', () => {
    it('renders with data-perspective="yes"', () => {
      render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      const book = screen.getByTestId('order-book');
      expect(book).toHaveAttribute('data-perspective', 'yes');
    });

    it('shows "Yes" in the title', () => {
      render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      expect(screen.getByText(/Yes.*Order Book/)).toBeInTheDocument();
    });

    it('displays original bid prices in Yes perspective', () => {
      render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      // Should show the original bid prices: 0.60, 0.58, 0.55
      expect(screen.getByText('0.60')).toBeInTheDocument();
      expect(screen.getByText('0.58')).toBeInTheDocument();
      expect(screen.getByText('0.55')).toBeInTheDocument();
    });

    it('displays original ask prices in Yes perspective', () => {
      render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      expect(screen.getByText('0.65')).toBeInTheDocument();
      expect(screen.getByText('0.68')).toBeInTheDocument();
      expect(screen.getByText('0.72')).toBeInTheDocument();
    });

    it('renders all 6 order rows', () => {
      render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      const rows = screen.getAllByTestId('order-row');
      expect(rows).toHaveLength(6);
    });

    it('shows the spread value', () => {
      render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      expect(screen.getByText('Spread: 0.05')).toBeInTheDocument();
    });

    it('has aria-label for accessibility', () => {
      render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      expect(screen.getByLabelText('Yes order book')).toBeInTheDocument();
    });
  });

  describe('No perspective (inverted book)', () => {
    it('renders with data-perspective="no"', () => {
      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      const book = screen.getByTestId('order-book');
      expect(book).toHaveAttribute('data-perspective', 'no');
    });

    it('shows "No" in the title', () => {
      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      expect(screen.getByText(/No.*Order Book/)).toBeInTheDocument();
    });

    it('inverts ask prices to become No bids (1 - price)', () => {
      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      // Yes asks 0.65, 0.68, 0.72 become No bids 0.35, 0.32, 0.28
      expect(screen.getByText('0.35')).toBeInTheDocument();
      expect(screen.getByText('0.32')).toBeInTheDocument();
      expect(screen.getByText('0.28')).toBeInTheDocument();
    });

    it('inverts bid prices to become No asks (1 - price)', () => {
      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      // Yes bids 0.60, 0.58, 0.55 become No asks 0.40, 0.42, 0.45
      expect(screen.getByText('0.40')).toBeInTheDocument();
      expect(screen.getByText('0.42')).toBeInTheDocument();
      expect(screen.getByText('0.45')).toBeInTheDocument();
    });

    it('preserves sizes in the inverted book', () => {
      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      // Sizes from asks (now bids): 15, 25, 35
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
      // Sizes from bids (now asks): 10, 20, 30
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('renders 6 order rows in No perspective', () => {
      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      const rows = screen.getAllByTestId('order-row');
      expect(rows).toHaveLength(6);
    });

    it('has aria-label for No perspective', () => {
      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      expect(screen.getByLabelText('No order book')).toBeInTheDocument();
    });
  });

  describe('Yes and No perspectives show complementary prices', () => {
    it('Yes bid + No ask = 1.00 for each price level', () => {
      // Yes bids: 0.60, 0.58, 0.55
      // No asks should be: 0.40, 0.42, 0.45
      const { unmount } = render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      expect(screen.getByText('0.60')).toBeInTheDocument();
      unmount();

      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      expect(screen.getByText('0.40')).toBeInTheDocument();
      // 0.60 + 0.40 = 1.00
    });

    it('Yes ask + No bid = 1.00 for each price level', () => {
      // Yes asks: 0.65, 0.68, 0.72
      // No bids should be: 0.35, 0.32, 0.28
      const { unmount } = render(<OrderBook orderBookData={mockBook} perspective="yes" />);
      expect(screen.getByText('0.65')).toBeInTheDocument();
      unmount();

      render(<OrderBook orderBookData={mockBook} perspective="no" />);
      expect(screen.getByText('0.35')).toBeInTheDocument();
      // 0.65 + 0.35 = 1.00
    });
  });

  describe('Empty book handling', () => {
    it('shows "No orders" for both sides when book is empty', () => {
      const emptyBook: OrderBookState = {
        marketAddress: 'empty',
        bids: [],
        asks: [],
        lastUpdated: Date.now(),
        spread: null,
      };

      render(<OrderBook orderBookData={emptyBook} perspective="yes" />);
      const noOrders = screen.getAllByText('No orders');
      expect(noOrders).toHaveLength(2);
    });

    it('does not show spread when spread is null', () => {
      const emptyBook: OrderBookState = {
        marketAddress: 'empty',
        bids: [],
        asks: [],
        lastUpdated: Date.now(),
        spread: null,
      };

      render(<OrderBook orderBookData={emptyBook} perspective="yes" />);
      expect(screen.queryByText(/Spread/)).not.toBeInTheDocument();
    });

    it('handles No perspective on empty book', () => {
      const emptyBook: OrderBookState = {
        marketAddress: 'empty',
        bids: [],
        asks: [],
        lastUpdated: Date.now(),
        spread: null,
      };

      render(<OrderBook orderBookData={emptyBook} perspective="no" />);
      const noOrders = screen.getAllByText('No orders');
      expect(noOrders).toHaveLength(2);
    });
  });

  describe('One-sided book', () => {
    it('handles book with only bids', () => {
      const bidsOnly: OrderBookState = {
        marketAddress: 'bids-only',
        bids: [{ price: 0.50, size: 10, side: 'bid' }],
        asks: [],
        lastUpdated: Date.now(),
        spread: null,
      };

      render(<OrderBook orderBookData={bidsOnly} perspective="yes" />);
      expect(screen.getByText('0.50')).toBeInTheDocument();
      expect(screen.getByText('No orders')).toBeInTheDocument();
    });

    it('handles book with only asks', () => {
      const asksOnly: OrderBookState = {
        marketAddress: 'asks-only',
        bids: [],
        asks: [{ price: 0.70, size: 20, side: 'ask' }],
        lastUpdated: Date.now(),
        spread: null,
      };

      render(<OrderBook orderBookData={asksOnly} perspective="yes" />);
      expect(screen.getByText('0.70')).toBeInTheDocument();
      expect(screen.getByText('No orders')).toBeInTheDocument();
    });
  });
});
