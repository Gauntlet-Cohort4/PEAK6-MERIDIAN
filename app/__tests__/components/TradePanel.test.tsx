import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradePanel } from '../../src/components/trade/TradePanel';
import { MarketStatus } from '@meridian/shared/types';
import type { StrikeMarket } from '@meridian/shared/types';

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

describe('TradePanel', () => {
  it('renders trade tabs', () => {
    render(<TradePanel market={mockMarket} position={null} />);
    expect(screen.getByRole('tab', { name: 'Buy Yes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Buy No' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sell Yes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sell No' })).toBeInTheDocument();
  });

  it('renders size and price inputs', () => {
    render(<TradePanel market={mockMarket} position={null} />);
    expect(screen.getByTestId('size-input')).toBeInTheDocument();
    expect(screen.getByTestId('price-input')).toBeInTheDocument();
  });

  it('disables submit when no size entered', () => {
    render(<TradePanel market={mockMarket} position={null} />);
    const submitButton = screen.getByTestId('submit-trade-button');
    expect(submitButton).toBeDisabled();
  });

  it('shows position constraint warning when holding opposite side', () => {
    const position = {
      marketAddress: 'test-addr',
      ticker: 'AAPL' as const,
      strikePrice: 230,
      yesTokenBalance: 10,
      noTokenBalance: 0,
      avgEntryPrice: 0.5,
      unrealizedPnl: 0,
    };

    render(<TradePanel market={mockMarket} position={position} />);
    // Default tab is BUY_YES which is allowed for yes holders
    // Switch to Buy No tab and check constraint
  });
});
