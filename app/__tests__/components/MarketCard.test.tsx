import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketCard } from '../../src/components/markets/MarketCard';
import { MarketStatus } from '@meridian/shared/types';
import type { StrikeMarket, OrderBookState } from '@meridian/shared/types';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockMarket: StrikeMarket = {
  address: 'test-addr',
  ticker: 'AAPL',
  strikePrice: 230,
  expiryTimestamp: Date.now() + 3600000,
  status: MarketStatus.OPEN,
  yesTokenMint: 'yes-mint',
  noTokenMint: 'no-mint',
  oracleFeedId: 'feed-id',
  settlementPrice: null,
  createdAt: Date.now(),
  settledAt: null,
};

const mockOrderBook: OrderBookState = {
  marketAddress: 'test-addr',
  bids: [{ price: 0.60, size: 10, side: 'bid' }],
  asks: [{ price: 0.65, size: 15, side: 'ask' }],
  lastUpdated: Date.now(),
  spread: 0.05,
};

describe('MarketCard', () => {
  it('renders ticker and strike price', () => {
    render(<MarketCard market={mockMarket} orderBook={mockOrderBook} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Strike: $230.00')).toBeInTheDocument();
  });

  it('renders Yes and No prices', () => {
    render(<MarketCard market={mockMarket} orderBook={mockOrderBook} />);
    // mid = (0.60 + 0.65) / 2 = 0.625
    expect(screen.getByText('0.63')).toBeInTheDocument(); // Yes (rounded)
  });

  it('renders implied probability', () => {
    render(<MarketCard market={mockMarket} orderBook={mockOrderBook} />);
    expect(screen.getByText('62.5%')).toBeInTheDocument();
  });

  it('renders dash when no order book', () => {
    render(<MarketCard market={mockMarket} orderBook={null} />);
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows low liquidity badge for one-sided book', () => {
    const oneSidedBook: OrderBookState = {
      ...mockOrderBook,
      asks: [],
      spread: null,
    };
    render(<MarketCard market={mockMarket} orderBook={oneSidedBook} />);
    expect(screen.getByTestId('low-liquidity-badge')).toBeInTheDocument();
  });

  it('renders market status badge', () => {
    render(<MarketCard market={mockMarket} orderBook={mockOrderBook} />);
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('links to trade page', () => {
    render(<MarketCard market={mockMarket} orderBook={mockOrderBook} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/trade/test-addr');
  });
});
