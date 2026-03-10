import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradeConfirmation } from '../../src/components/trade/TradeConfirmation';

const mockData = {
  side: 'BUY_YES',
  size: 10,
  price: 0.65,
  ticker: 'AAPL',
  strikePrice: 230,
};

describe('TradeConfirmation', () => {
  it('renders when open with data', () => {
    render(
      <TradeConfirmation
        isOpen={true}
        data={mockData}
        skipConfirmation={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onSkipChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('trade-confirmation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirm Trade' })).toBeInTheDocument();
  });

  it('displays order details', () => {
    render(
      <TradeConfirmation
        isOpen={true}
        data={mockData}
        skipConfirmation={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onSkipChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/BUY YES 10 contracts at 0\.65/)).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <TradeConfirmation
        isOpen={true}
        data={mockData}
        skipConfirmation={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        onSkipChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId('confirm-trade-button'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('has skip confirmation checkbox', () => {
    render(
      <TradeConfirmation
        isOpen={true}
        data={mockData}
        skipConfirmation={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onSkipChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('skip-confirmation-checkbox')).toBeInTheDocument();
  });

  it('returns null when data is null', () => {
    const { container } = render(
      <TradeConfirmation
        isOpen={true}
        data={null}
        skipConfirmation={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onSkipChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
