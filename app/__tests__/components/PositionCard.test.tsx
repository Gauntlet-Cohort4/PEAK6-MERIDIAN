import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PositionCard } from '../../src/components/portfolio/PositionCard';
import { MarketStatus, TradeSide } from '@meridian/shared/types';
import type { Position, StrikeMarket } from '@meridian/shared/types';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const makePosition = (
  overrides: Partial<Position> = {},
): Position => ({
  marketAddress: 'test-market',
  ticker: 'AAPL',
  strikePrice: 230,
  yesTokenBalance: 10,
  noTokenBalance: 0,
  avgEntryPrice: 0.60,
  unrealizedPnl: 1.50,
  ...overrides,
});

const makeMarket = (
  overrides: Partial<StrikeMarket> = {},
): StrikeMarket => ({
  address: 'test-market',
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
  ...overrides,
});

describe('PositionCard', () => {
  describe('Active position display', () => {
    it('renders ticker name', () => {
      render(<PositionCard pos={makePosition()} market={makeMarket()} />);
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('shows Yes badge for Yes position', () => {
      render(
        <PositionCard
          pos={makePosition({ yesTokenBalance: 10, noTokenBalance: 0 })}
          market={makeMarket()}
        />,
      );
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('shows No badge for No position', () => {
      render(
        <PositionCard
          pos={makePosition({ yesTokenBalance: 0, noTokenBalance: 15 })}
          market={makeMarket()}
        />,
      );
      expect(screen.getByText('No')).toBeInTheDocument();
    });

    it('displays strike price', () => {
      render(<PositionCard pos={makePosition()} market={makeMarket()} />);
      expect(screen.getByText('Strike: $230.00')).toBeInTheDocument();
    });

    it('displays quantity for Yes position', () => {
      render(
        <PositionCard
          pos={makePosition({ yesTokenBalance: 25, noTokenBalance: 0 })}
          market={makeMarket()}
        />,
      );
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('displays quantity for No position', () => {
      render(
        <PositionCard
          pos={makePosition({ yesTokenBalance: 0, noTokenBalance: 15 })}
          market={makeMarket()}
        />,
      );
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('displays average entry price', () => {
      render(
        <PositionCard
          pos={makePosition({ avgEntryPrice: 0.60 })}
          market={makeMarket()}
        />,
      );
      expect(screen.getByText('0.60')).toBeInTheDocument();
    });

    it('shows N/A when avg entry price is 0', () => {
      render(
        <PositionCard
          pos={makePosition({ avgEntryPrice: 0 })}
          market={makeMarket()}
        />,
      );
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('shows "Awaiting settlement" status for active market', () => {
      render(<PositionCard pos={makePosition()} market={makeMarket()} />);
      expect(screen.getByText('Awaiting settlement')).toBeInTheDocument();
    });

    it('shows Trade button linking to trade page for active positions', () => {
      render(<PositionCard pos={makePosition()} market={makeMarket()} />);
      const tradeBtn = screen.getByText('Trade');
      expect(tradeBtn).toBeInTheDocument();
      // The link should point to the trade page
      const link = tradeBtn.closest('a');
      expect(link).toHaveAttribute('href', '/trade/test-market');
    });
  });

  describe('Settled position - Winner', () => {
    const settledMarketYesWins = makeMarket({
      status: MarketStatus.SETTLED,
      settlementPrice: 235, // Above strike 230 => YES wins
      settledAt: Date.now(),
    });

    const yesHolderPosition = makePosition({
      yesTokenBalance: 10,
      noTokenBalance: 0,
    });

    it('shows Winner badge for winning position', () => {
      render(
        <PositionCard
          pos={yesHolderPosition}
          market={settledMarketYesWins}
        />,
      );
      expect(screen.getByText('Winner')).toBeInTheDocument();
    });

    it('shows settlement price', () => {
      render(
        <PositionCard
          pos={yesHolderPosition}
          market={settledMarketYesWins}
        />,
      );
      expect(screen.getByText('Settled at: $235.00')).toBeInTheDocument();
    });

    it('shows payout amount for winner', () => {
      render(
        <PositionCard
          pos={yesHolderPosition}
          market={settledMarketYesWins}
        />,
      );
      // Payout should be yesTokenBalance = 10 => $10.00
      expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    it('shows Redeem button when onRedeem handler is provided', () => {
      const onRedeem = vi.fn();
      render(
        <PositionCard
          pos={yesHolderPosition}
          market={settledMarketYesWins}
          onRedeem={onRedeem}
        />,
      );
      expect(screen.getByText('Redeem $10.00 USDC')).toBeInTheDocument();
    });

    it('calls onRedeem with correct args when Redeem is clicked', async () => {
      const user = userEvent.setup();
      const onRedeem = vi.fn();

      render(
        <PositionCard
          pos={yesHolderPosition}
          market={settledMarketYesWins}
          onRedeem={onRedeem}
        />,
      );

      await user.click(screen.getByText('Redeem $10.00 USDC'));

      expect(onRedeem).toHaveBeenCalledWith(
        'test-market',
        TradeSide.REDEEM_YES,
        10,
      );
    });

    it('shows Redeeming... text when isRedeeming is true', () => {
      const onRedeem = vi.fn();
      render(
        <PositionCard
          pos={yesHolderPosition}
          market={settledMarketYesWins}
          onRedeem={onRedeem}
          isRedeeming={true}
        />,
      );
      expect(screen.getByText('Redeeming...')).toBeInTheDocument();
    });

    it('disables Redeem button when isRedeeming', () => {
      const onRedeem = vi.fn();
      render(
        <PositionCard
          pos={yesHolderPosition}
          market={settledMarketYesWins}
          onRedeem={onRedeem}
          isRedeeming={true}
        />,
      );
      expect(screen.getByText('Redeeming...')).toBeDisabled();
    });
  });

  describe('Settled position - Loser', () => {
    const settledMarketYesWins = makeMarket({
      status: MarketStatus.SETTLED,
      settlementPrice: 235, // YES wins
      settledAt: Date.now(),
    });

    const noHolderPosition = makePosition({
      yesTokenBalance: 0,
      noTokenBalance: 15,
    });

    it('shows Lost badge for losing position', () => {
      render(
        <PositionCard
          pos={noHolderPosition}
          market={settledMarketYesWins}
        />,
      );
      expect(screen.getByText('Lost')).toBeInTheDocument();
    });

    it('shows $0.00 payout for losing position', () => {
      render(
        <PositionCard
          pos={noHolderPosition}
          market={settledMarketYesWins}
        />,
      );
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('does not show Redeem button for losing position', () => {
      const onRedeem = vi.fn();
      render(
        <PositionCard
          pos={noHolderPosition}
          market={settledMarketYesWins}
          onRedeem={onRedeem}
        />,
      );
      expect(screen.queryByText(/Redeem/)).not.toBeInTheDocument();
    });
  });

  describe('Settled position - No wins scenario', () => {
    const settledMarketNoWins = makeMarket({
      status: MarketStatus.SETTLED,
      settlementPrice: 220, // Below strike 230 => NO wins
      settledAt: Date.now(),
    });

    it('shows Winner badge for No holder when No wins', () => {
      const noHolderPos = makePosition({
        yesTokenBalance: 0,
        noTokenBalance: 20,
      });

      render(
        <PositionCard
          pos={noHolderPos}
          market={settledMarketNoWins}
        />,
      );
      expect(screen.getByText('Winner')).toBeInTheDocument();
    });

    it('calls onRedeem with REDEEM_NO side when No wins', async () => {
      const user = userEvent.setup();
      const onRedeem = vi.fn();
      const noHolderPos = makePosition({
        yesTokenBalance: 0,
        noTokenBalance: 20,
      });

      render(
        <PositionCard
          pos={noHolderPos}
          market={settledMarketNoWins}
          onRedeem={onRedeem}
        />,
      );

      await user.click(screen.getByText('Redeem $20.00 USDC'));

      expect(onRedeem).toHaveBeenCalledWith(
        'test-market',
        TradeSide.REDEEM_NO,
        20,
      );
    });

    it('shows Lost badge for Yes holder when No wins', () => {
      const yesHolderPos = makePosition({
        yesTokenBalance: 10,
        noTokenBalance: 0,
      });

      render(
        <PositionCard
          pos={yesHolderPos}
          market={settledMarketNoWins}
        />,
      );
      expect(screen.getByText('Lost')).toBeInTheDocument();
    });
  });
});
