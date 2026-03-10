import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PayoffDisplay } from '../../src/components/trade/PayoffDisplay';
import { TradeSide } from '@meridian/shared/types';

describe('PayoffDisplay', () => {
  it('shows cost for Buy Yes', () => {
    render(
      <PayoffDisplay
        side={TradeSide.BUY_YES}
        size={10}
        price={0.65}
        ticker="AAPL"
        strikePrice={230}
      />,
    );
    expect(screen.getByText('You pay')).toBeInTheDocument();
    expect(screen.getByText('$6.50')).toBeInTheDocument();
    expect(
      screen.getByText(/You win \$1\.00 if AAPL closes above \$230/),
    ).toBeInTheDocument();
  });

  it('shows cost for Buy No', () => {
    render(
      <PayoffDisplay
        side={TradeSide.BUY_NO}
        size={5}
        price={0.35}
        ticker="NVDA"
        strikePrice={140}
      />,
    );
    expect(screen.getByText('$1.75')).toBeInTheDocument();
    expect(
      screen.getByText(/You win \$1\.00 if NVDA closes below \$140/),
    ).toBeInTheDocument();
  });

  it('shows max profit and loss for buy orders', () => {
    render(
      <PayoffDisplay
        side={TradeSide.BUY_YES}
        size={10}
        price={0.60}
        ticker="AAPL"
        strikePrice={230}
      />,
    );
    expect(screen.getByText(/Max profit/)).toBeInTheDocument();
    expect(screen.getByText(/Max loss/)).toBeInTheDocument();
  });

  it('shows receive label for sell orders', () => {
    render(
      <PayoffDisplay
        side={TradeSide.SELL_YES}
        size={5}
        price={0.70}
        ticker="TSLA"
        strikePrice={280}
      />,
    );
    expect(screen.getByText('You receive')).toBeInTheDocument();
  });
});
