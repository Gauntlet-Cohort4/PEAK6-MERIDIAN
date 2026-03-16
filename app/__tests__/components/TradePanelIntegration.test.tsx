import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradePanel } from '../../src/components/trade/TradePanel';
import { MarketStatus, TradeSide } from '@meridian/shared/types';
import type { StrikeMarket, Position } from '@meridian/shared/types';

// Mock useWallet
const mockPublicKey = {
  toBase58: () => '11111111111111111111111111111111',
};

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: mockPublicKey,
    signTransaction: vi.fn(),
    connected: true,
    wallets: [],
    wallet: null,
    select: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock demo mode to enable submit without real wallet
vi.mock('../../src/lib/demo', () => ({
  IS_DEMO_MODE: true,
}));

const mockSubmitOrder = vi.fn().mockResolvedValue('demo_sig_123');

vi.mock('../../src/hooks/useTradeActions', () => ({
  useTradeActions: () => ({
    submitOrder: mockSubmitOrder,
    isSubmitting: false,
    lastError: null,
    lastTxSignature: null,
  }),
}));

const mockMarket: StrikeMarket = {
  address: 'test-market-addr',
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

describe('TradePanel - Order Placement Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four trade tabs', () => {
    render(<TradePanel market={mockMarket} position={null} />);
    expect(screen.getByRole('tab', { name: 'Buy Yes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Buy No' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sell Yes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sell No' })).toBeInTheDocument();
  });

  it('has size and price inputs', () => {
    render(<TradePanel market={mockMarket} position={null} />);
    expect(screen.getByTestId('size-input')).toBeInTheDocument();
    expect(screen.getByTestId('price-input')).toBeInTheDocument();
  });

  it('disables submit button when size is zero', () => {
    render(<TradePanel market={mockMarket} position={null} />);
    const btn = screen.getByTestId('submit-trade-button');
    expect(btn).toBeDisabled();
  });

  it('enables submit button when size and price are valid', async () => {
    const user = userEvent.setup();
    render(<TradePanel market={mockMarket} position={null} />);

    const sizeInput = screen.getByTestId('size-input');
    await user.clear(sizeInput);
    await user.type(sizeInput, '5');

    const btn = screen.getByTestId('submit-trade-button');
    expect(btn).not.toBeDisabled();
  });

  it('shows order type buttons (Market and Limit)', () => {
    render(<TradePanel market={mockMarket} position={null} />);
    expect(screen.getByTestId('order-type-market')).toBeInTheDocument();
    expect(screen.getByTestId('order-type-limit')).toBeInTheDocument();
  });

  it('hides price input in market order mode', async () => {
    const user = userEvent.setup();
    render(<TradePanel market={mockMarket} position={null} />);

    await user.click(screen.getByTestId('order-type-market'));

    expect(screen.queryByTestId('price-input')).not.toBeInTheDocument();
  });

  it('switches active trade tab', async () => {
    const user = userEvent.setup();
    render(<TradePanel market={mockMarket} position={null} />);

    const buyNoTab = screen.getByRole('tab', { name: 'Buy No' });
    await user.click(buyNoTab);

    // The Buy No tab should now be selected (aria-selected)
    expect(buyNoTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows constraint warning when Buy No is selected but holding Yes', async () => {
    const user = userEvent.setup();
    const yesPosition: Position = {
      marketAddress: 'test-market-addr',
      ticker: 'AAPL',
      strikePrice: 230,
      yesTokenBalance: 10,
      noTokenBalance: 0,
      avgEntryPrice: 0.5,
      unrealizedPnl: 0,
    };

    render(<TradePanel market={mockMarket} position={yesPosition} />);

    // Switch to Buy No
    await user.click(screen.getByRole('tab', { name: 'Buy No' }));

    expect(screen.getByTestId('position-constraint-warning')).toBeInTheDocument();
    expect(screen.getByText(/BUY NO is not available/i)).toBeInTheDocument();
  });

  it('disables submit when trade side is not allowed due to position constraints', async () => {
    const user = userEvent.setup();
    const yesPosition: Position = {
      marketAddress: 'test-market-addr',
      ticker: 'AAPL',
      strikePrice: 230,
      yesTokenBalance: 10,
      noTokenBalance: 0,
      avgEntryPrice: 0.5,
      unrealizedPnl: 0,
    };

    render(<TradePanel market={mockMarket} position={yesPosition} />);

    // Switch to Buy No
    await user.click(screen.getByRole('tab', { name: 'Buy No' }));

    // Enter valid size
    const sizeInput = screen.getByTestId('size-input');
    await user.clear(sizeInput);
    await user.type(sizeInput, '5');

    // Submit should be disabled because position constraint
    const btn = screen.getByTestId('submit-trade-button');
    expect(btn).toBeDisabled();
  });

  it('allows Sell Yes when holding Yes tokens', async () => {
    const user = userEvent.setup();
    const yesPosition: Position = {
      marketAddress: 'test-market-addr',
      ticker: 'AAPL',
      strikePrice: 230,
      yesTokenBalance: 10,
      noTokenBalance: 0,
      avgEntryPrice: 0.5,
      unrealizedPnl: 0,
    };

    render(<TradePanel market={mockMarket} position={yesPosition} />);

    // Switch to Sell Yes
    await user.click(screen.getByRole('tab', { name: 'Sell Yes' }));

    // No constraint warning should appear
    expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
  });

  it('allows Buy Yes and Buy No when no position', async () => {
    const user = userEvent.setup();
    render(<TradePanel market={mockMarket} position={null} />);

    // Buy Yes (default) - no warning
    expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();

    // Switch to Buy No - still no warning
    await user.click(screen.getByRole('tab', { name: 'Buy No' }));
    expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
  });
});
